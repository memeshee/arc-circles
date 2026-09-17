// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal ERC-20 interface. USDC/EURC on Arc use 6 decimals.
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Phase-2 yield adapter (e.g. USYC once the circle operator is
/// onboarded via Circle Mint — USYC is allowlisted and cannot be held
/// permissionlessly). Zero address = holding mode: funds stay in the
/// circle contract 1:1. No mock yield is ever reported.
interface IYieldAdapter {
    function deposit(address token, uint256 amount) external;
    function withdraw(address token, uint256 amount, address to) external;
    function balanceOf(address token) external view returns (uint256);
}

/// @title SavingsCircle — onchain rotating savings circle (ROSCA) for Arc.
/// @notice Fixed membership, fixed payout order chosen at creation (no
/// randomness needed — Arc sets PREV_RANDAO to 0). Each round every member
/// contributes `contribution` of `token`; once the round closes anyone can
/// trigger `payout`, sending the whole pot to that round's recipient.
/// Late contributions pay a penalty that stays in the pot, so punctual
/// members earn from late ones. Anyone may cover for another member via
/// `contributeFor`, mirroring how real circles work.
contract SavingsCircle {
    IERC20 public immutable token;
    uint256 public immutable contribution;
    uint256 public immutable roundDuration;
    uint256 public immutable startTime;
    uint256 public immutable penaltyBps;
    address public immutable creator;

    address[] public members;
    mapping(address => bool) public isMember;
    /// paid[round][member]
    mapping(uint256 => mapping(address => bool)) public paid;

    uint256 public currentRound;
    address public yieldAdapter;
    bool public complete;

    error NotMember();
    error WrongRound();
    error AlreadyPaid();
    error RoundNotClosed();
    error RecipientInArrears();
    error TransferFailed();
    error NoAdapter();
    error NotCreator();
    error AlreadyComplete();

    event Contributed(uint256 indexed round, address indexed member, address indexed payer, uint256 amount, uint256 penalty);
    event PaidOut(uint256 indexed round, address indexed recipient, uint256 amount);
    event CircleCompleted();
    event YieldAdapterSet(address indexed adapter);
    event YieldMoved(address indexed adapter, bool indexed intoYield, uint256 amount);

    constructor(
        address _token,
        uint256 _contribution,
        uint256 _roundDuration,
        address[] memory _members,
        uint256 _penaltyBps,
        address _creator
    ) {
        require(_token != address(0), "zero token");
        require(_contribution > 0, "zero contribution");
        require(_roundDuration >= 60, "round too short");
        require(_members.length >= 2, "need 2+ members");
        require(_penaltyBps <= 2000, "penalty >20%");
        require(_creator != address(0), "zero creator");
        token = IERC20(_token);
        contribution = _contribution;
        roundDuration = _roundDuration;
        startTime = block.timestamp;
        penaltyBps = _penaltyBps;
        creator = _creator;
        for (uint256 i = 0; i < _members.length; i++) {
            require(_members[i] != address(0), "zero member");
            require(!isMember[_members[i]], "duplicate member");
            isMember[_members[i]] = true;
            members.push(_members[i]);
        }
    }

    function totalRounds() external view returns (uint256) {
        return members.length;
    }

    function memberCount() external view returns (uint256) {
        return members.length;
    }

    function roundDeadline(uint256 round) public view returns (uint256) {
        return startTime + (round + 1) * roundDuration;
    }

    function recipientOf(uint256 round) public view returns (address) {
        return members[round % members.length];
    }

    function roundFullyPaid(uint256 round) public view returns (bool) {
        for (uint256 i = 0; i < members.length; i++) {
            if (!paid[round][members[i]]) return false;
        }
        return true;
    }

    function memberPaidThrough(address member, uint256 round) public view returns (bool) {
        for (uint256 r = 0; r <= round; r++) {
            if (!paid[r][member]) return false;
        }
        return true;
    }

    /// @notice Contribute to the current round. Late payments add a penalty
    /// that stays in the pot for future recipients.
    function contribute() external {
        _contributeFor(msg.sender, currentRound);
    }

    /// @notice Cover another member's contribution for the current round.
    function contributeFor(address member) external {
        _contributeFor(member, currentRound);
    }

    function _contributeFor(address member, uint256 round) internal {
        if (complete) revert AlreadyComplete();
        if (!isMember[member]) revert NotMember();
        if (round != currentRound) revert WrongRound();
        if (paid[round][member]) revert AlreadyPaid();
        uint256 penalty = 0;
        if (block.timestamp > roundDeadline(round)) {
            penalty = (contribution * penaltyBps) / 10000;
        }
        paid[round][member] = true;
        emit Contributed(round, member, msg.sender, contribution, penalty);
        if (!token.transferFrom(msg.sender, address(this), contribution + penalty)) {
            revert TransferFailed();
        }
    }

    /// @notice Pay the whole pot to the round's recipient. Callable by anyone
    /// once the deadline passes OR everyone has paid (fast path for demos
    /// and punctual circles). The recipient must have paid every round
    /// through this one — others can cover via `contributeFor`.
    function payout() external {
        if (complete) revert AlreadyComplete();
        uint256 round = currentRound;
        bool closed = block.timestamp >= roundDeadline(round) || roundFullyPaid(round);
        if (!closed) revert RoundNotClosed();
        address recipient = recipientOf(round);
        if (!memberPaidThrough(recipient, round)) revert RecipientInArrears();
        uint256 pot = token.balanceOf(address(this));
        currentRound = round + 1;
        emit PaidOut(round, recipient, pot);
        if (currentRound >= members.length) {
            complete = true;
            emit CircleCompleted();
        }
        if (!token.transfer(recipient, pot)) revert TransferFailed();
    }

    // ---- Phase-2 yield adapter (holding mode until set) ----

    function setYieldAdapter(address adapter) external {
        if (msg.sender != creator) revert NotCreator();
        yieldAdapter = adapter;
        emit YieldAdapterSet(adapter);
    }

    function moveToYield(uint256 amount) external {
        if (yieldAdapter == address(0)) revert NoAdapter();
        if (!token.transfer(yieldAdapter, amount)) revert TransferFailed();
        IYieldAdapter(yieldAdapter).deposit(address(token), amount);
        emit YieldMoved(yieldAdapter, true, amount);
    }

    function withdrawFromYield(uint256 amount) external {
        if (yieldAdapter == address(0)) revert NoAdapter();
        IYieldAdapter(yieldAdapter).withdraw(address(token), amount, address(this));
        emit YieldMoved(yieldAdapter, false, amount);
    }
}

/// @title CircleFactory — deploys SavingsCircle instances and indexes them.
contract CircleFactory {
    address[] public allCircles;
    mapping(address => bool) public isCircle;

    event CircleCreated(
        address indexed circle,
        address indexed token,
        address indexed creator,
        uint256 contribution,
        uint256 roundDuration,
        uint256 memberCount
    );

    function createCircle(
        address token,
        uint256 contribution,
        uint256 roundDuration,
        address[] calldata members,
        uint256 penaltyBps
    ) external returns (address circle) {
        SavingsCircle c = new SavingsCircle(
            token, contribution, roundDuration, members, penaltyBps, msg.sender
        );
        circle = address(c);
        allCircles.push(circle);
        isCircle[circle] = true;
        emit CircleCreated(circle, token, msg.sender, contribution, roundDuration, members.length);
    }

    function circleCount() external view returns (uint256) {
        return allCircles.length;
    }
}
