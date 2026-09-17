// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/SavingsCircle.sol";

contract Deploy is Script {
    function run() external returns (address factory) {
        vm.startBroadcast();
        CircleFactory f = new CircleFactory();
        vm.stopBroadcast();
        factory = address(f);
        console2.log("CircleFactory:", factory);
    }
}
