// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * DIDRegistry.sol
 * 
 * Registru on-chain pentru Identități Descentralizate (DID)
 * Permite maparea între o adresă Ethereum și un DID Document Hash (IPFS CID)
 */

contract DIDRegistry {
    
    struct DIDRecord {
        address owner;
        string didFragment; // partea unică din did:ethereum:addr#fragment
        string docCID;      // IPFS CID unde este stocat documentul JSON complet
        bool active;
        uint256 createdAt;
        uint256 updatedAt;
    }

    // Mapping: Address -> DID Record
    mapping(address => DIDRecord) public dids;
    
    // Events
    event DIDRegistered(address indexed owner, string did, string docCID);
    event DIDUpdated(address indexed owner, string newDocCID);
    event DIDDeactivated(address indexed owner);

    /**
     * Înregistrează un nou DID
     * @param _didFragment - identificatorul unic
     * @param _docCID - IPFS CID-ul documentului JSON
     */
    function registerDID(string memory _didFragment, string memory _docCID) public {
        require(dids[msg.sender].createdAt == 0, "DID already registered for this address");
        
        dids[msg.sender] = DIDRecord({
            owner: msg.sender,
            didFragment: _didFragment,
            docCID: _docCID,
            active: true,
            createdAt: block.timestamp,
            updatedAt: block.timestamp
        });

        string memory fullDID = string(abi.encodePacked("did:ethereum:", toAsciiString(msg.sender), "#", _didFragment));
        emit DIDRegistered(msg.sender, fullDID, _docCID);
    }

    /**
     * Actualizează documentul DID (ex: rotire chei)
     */
    function updateDIDDocument(string memory _newDocCID) public {
        require(dids[msg.sender].active, "DID not active or not found");
        
        dids[msg.sender].docCID = _newDocCID;
        dids[msg.sender].updatedAt = block.timestamp;
        
        emit DIDUpdated(msg.sender, _newDocCID);
    }

    /**
     * Dezactivează DID
     */
    function deactivateDID() public {
        require(dids[msg.sender].active, "DID not active");
        
        dids[msg.sender].active = false;
        dids[msg.sender].updatedAt = block.timestamp;
        
        emit DIDDeactivated(msg.sender);
    }

    /**
     * Verifică dacă o adresă are un DID valid
     */
    function resolveDID(address _owner) public view returns (string memory did, string memory docCID, bool active) {
        DIDRecord memory record = dids[_owner];
        if (record.createdAt == 0) return ("", "", false);
        
        string memory fullDID = string(abi.encodePacked("did:ethereum:", toAsciiString(_owner), "#", record.didFragment));
        return (fullDID, record.docCID, record.active);
    }

    // Helper: Address to String
    function toAsciiString(address x) internal pure returns (string memory) {
        bytes memory s = new bytes(40);
        for (uint i = 0; i < 20; i++) {
            bytes1 b = bytes1(uint8(uint(uint160(x)) / (2**(8*(19 - i)))));
            bytes1 hi = bytes1(uint8(b) / 16);
            bytes1 lo = bytes1(uint8(b) - 16 * uint8(hi));
            s[2*i] = char(hi);
            s[2*i+1] = char(lo);            
        }
        return string(s);
    }

    function char(bytes1 b) internal pure returns (bytes1 c) {
        if (uint8(b) < 10) return bytes1(uint8(b) + 0x30);
        else return bytes1(uint8(b) + 0x57);
    }
}
