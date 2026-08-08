// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {CoOpVault} from "../src/CoOpVault.sol";
import {AttestationRegistry} from "../src/AttestationRegistry.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerKey);

        CoOpVault vault = new CoOpVault();
        AttestationRegistry registry = new AttestationRegistry("Co-Op Attestations", "COOPA");

        registry.setAuthorizedIssuer(address(vault), true);

        vm.stopBroadcast();

        console.log("=== DEPLOYMENT COMPLETE ===");
        console.log("CoOpVault:", address(vault));
        console.log("AttestationRegistry:", address(registry));
    }
}
