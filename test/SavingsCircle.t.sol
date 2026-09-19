// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SavingsCircle.sol";

contract MockToken is IERC20 {
    mapping(address => uint256) public override balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "no allowance");
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

contract SavingsCircleTest is Test {
    MockToken token;
    CircleFactory factory;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    address cara = address(0xCA9A);
    uint256 constant CONTRIB = 10e6; // 10 USDC
    uint256 constant ROUND = 1 days;

    function setUp() public {
        token = new MockToken();
        factory = new CircleFactory();
        token.mint(alice, 1000e6);
        token.mint(bob, 1000e6);
        token.mint(cara, 1000e6);
    }

    function _members() internal view returns (address[] memory) {
        address[] memory m = new address[](3);
        m[0] = alice;
        m[1] = bob;
        m[2] = cara;
        return m;
    }

    function _newCircle() internal returns (SavingsCircle) {
        address addr = factory.createCircle(address(token), CONTRIB, ROUND, _members(), 500);
        return SavingsCircle(addr);
    }

    function _approveAll(SavingsCircle c) internal {
        vm.prank(alice);
        token.approve(address(c), type(uint256).max);
        vm.prank(bob);
        token.approve(address(c), type(uint256).max);
        vm.prank(cara);
        token.approve(address(c), type(uint256).max);
    }

    function testFullLifecycle() public {
        SavingsCircle c = _newCircle();
        _approveAll(c);
        // Round 0 -> alice gets 30
        vm.prank(alice);
        c.contribute();
        vm.prank(bob);
        c.contribute();
        vm.prank(cara);
        c.contribute();
        assertTrue(c.roundFullyPaid(0));
        uint256 before = token.balanceOf(alice);
        c.payout();
        assertEq(token.balanceOf(alice) - before, 30e6);
        assertEq(uint256(c.currentRound()), 1);
        // Round 1 -> bob
        vm.prank(alice);
        c.contribute();
        vm.prank(bob);
        c.contribute();
        vm.prank(cara);
        c.contribute();
        before = token.balanceOf(bob);
        c.payout();
        assertEq(token.balanceOf(bob) - before, 30e6);
        // Round 2 -> cara, completes circle
        vm.prank(alice);
        c.contribute();
        vm.prank(bob);
        c.contribute();
        vm.prank(cara);
        c.contribute();
        before = token.balanceOf(cara);
        c.payout();
        assertEq(token.balanceOf(cara) - before, 30e6);
        assertTrue(c.complete());
    }

    function testLatePenaltyStaysInPot() public {
        SavingsCircle c = _newCircle();
        _approveAll(c);
        vm.prank(alice);
        c.contribute();
        vm.prank(bob);
        c.contribute();
        skip(ROUND + 1); // cara is late: 5% of 10 = 0.5 USDC penalty
        vm.prank(cara);
        c.contribute();
        uint256 before = token.balanceOf(alice);
        c.payout();
        assertEq(token.balanceOf(alice) - before, 30.5e6);
    }

    function testRecipientInArrearsReverts() public {
        SavingsCircle c = _newCircle();
        _approveAll(c);
        // alice (round-0 recipient) does not pay; others do
        vm.prank(bob);
        c.contribute();
        vm.prank(cara);
        c.contribute();
        skip(ROUND + 1);
        vm.expectRevert(SavingsCircle.RecipientInArrears.selector);
        c.payout();
        // bob covers for alice, payout succeeds
        vm.prank(bob);
        c.contributeFor(alice);
        c.payout();
        assertEq(uint256(c.currentRound()), 1);
    }

    function testEarlyPayoutWhenAllPaid() public {
        SavingsCircle c = _newCircle();
        _approveAll(c);
        vm.prank(alice);
        c.contribute();
        vm.prank(bob);
        c.contribute();
        vm.prank(cara);
        c.contribute();
        // no time skip: all paid -> payout allowed before deadline
        c.payout();
        assertEq(uint256(c.currentRound()), 1);
    }

    function testRoundNotClosedReverts() public {
        SavingsCircle c = _newCircle();
        _approveAll(c);
        vm.prank(alice);
        c.contribute();
        vm.expectRevert(SavingsCircle.RoundNotClosed.selector);
        c.payout();
    }

    function testDoublePayReverts() public {
        SavingsCircle c = _newCircle();
        _approveAll(c);
        vm.prank(alice);
        c.contribute();
        vm.prank(alice);
        vm.expectRevert(SavingsCircle.AlreadyPaid.selector);
        c.contribute();
    }

    function testFactoryIndexes() public {
        _newCircle();
        _newCircle();
        assertEq(factory.circleCount(), 2);
        assertTrue(factory.isCircle(factory.allCircles(0)));
    }

    function testRejectsBadParams() public {
        address[] memory one = new address[](1);
        one[0] = alice;
        vm.expectRevert("need 2+ members");
        factory.createCircle(address(token), CONTRIB, ROUND, one, 500);
        address[] memory dup = new address[](2);
        dup[0] = alice;
        dup[1] = alice;
        vm.expectRevert("duplicate member");
        factory.createCircle(address(token), CONTRIB, ROUND, dup, 500);
    }

    function testYieldAdapterGating() public {
        SavingsCircle c = _newCircle();
        vm.expectRevert(SavingsCircle.NoAdapter.selector);
        c.moveToYield(100);
        vm.prank(alice);
        vm.expectRevert(SavingsCircle.NotCreator.selector);
        c.setYieldAdapter(address(0xBEEF));
    }
}
