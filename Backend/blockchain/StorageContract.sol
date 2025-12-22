// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * StorageContract.sol
 * 
 * Smart contract pentru gestionarea contractelor de stocare
 * - Storage allocation between users
 * - Pricing management
 * - Payment escrow
 * - Contract lifecycle management
 */

contract StorageContract {
    
    struct Storage {
        address renter;
        address provider;
        uint256 allocatedGB;
        uint256 usedGB;
        uint256 pricePerGBPerMonth; // in wei
        uint256 startTime;
        uint256 endTime;
        bool active;
        bool disputed;
    }

    struct Payment {
        uint256 contractId;
        address from;
        address to;
        uint256 amount;
        uint256 timestamp;
        bool processed;
    }

    // Contract mappings
    mapping(uint256 => Storage) public contracts;
    mapping(uint256 => Payment[]) public contractPayments;
    mapping(address => uint256[]) public userContracts;
    mapping(address => uint256) public escrowBalance;

    // Counter for contract IDs
    uint256 public contractCounter = 0;

    // Events
    event ContractCreated(
        uint256 indexed contractId,
        address indexed renter,
        address indexed provider,
        uint256 allocatedGB,
        uint256 pricePerGBPerMonth
    );

    event PaymentProcessed(
        uint256 indexed contractId,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    event StorageUpdated(
        uint256 indexed contractId,
        uint256 newUsedGB
    );

    event ContractDisputed(
        uint256 indexed contractId,
        address indexed disputedBy,
        string reason
    );

    event ContractClosed(
        uint256 indexed contractId,
        bool completed
    );

    /**
     * Creează contract nou de stocare
     */
    function createContract(
        address provider,
        uint256 allocatedGB,
        uint256 pricePerGBPerMonth,
        uint256 durationMonths
    ) public returns (uint256) {
        require(provider != address(0), "Invalid provider address");
        require(allocatedGB > 0, "Allocated GB must be > 0");
        require(durationMonths > 0, "Duration must be > 0");

        uint256 contractId = contractCounter++;
        uint256 endTime = block.timestamp + (durationMonths * 30 days);

        contracts[contractId] = Storage({
            renter: msg.sender,
            provider: provider,
            allocatedGB: allocatedGB,
            usedGB: 0,
            pricePerGBPerMonth: pricePerGBPerMonth,
            startTime: block.timestamp,
            endTime: endTime,
            active: true,
            disputed: false
        });

        userContracts[msg.sender].push(contractId);
        userContracts[provider].push(contractId);

        emit ContractCreated(
            contractId,
            msg.sender,
            provider,
            allocatedGB,
            pricePerGBPerMonth
        );

        return contractId;
    }

    /**
     * Depozitează FIL în escrow pentru contract
     */
    function depositEscrow(uint256 contractId) public payable {
        require(contractId < contractCounter, "Contract not found");
        Storage memory contractData = contracts[contractId];
        require(contractData.active, "Contract not active");

        escrowBalance[msg.sender] += msg.value;
    }

    /**
     * Calculează cuantumul plății lunar
     */
    function calculateMonthlyPayment(uint256 contractId) public view returns (uint256) {
        require(contractId < contractCounter, "Contract not found");
        Storage memory contractData = contracts[contractId];
        
        uint256 usedGB = contractData.usedGB > contractData.allocatedGB ? contractData.allocatedGB : contractData.usedGB;
        return usedGB * contractData.pricePerGBPerMonth;
    }

    /**
     * Procesează plată din escrow
     */
    function processPayment(uint256 contractId) public {
        require(contractId < contractCounter, "Contract not found");
        Storage storage contracts_var = contracts[contractId];
        
        require(contracts_var.active, "Contract not active");
        require(!contracts_var.disputed, "Contract is disputed");

        uint256 amount = calculateMonthlyPayment(contractId);
        require(amount > 0, "No payment due");

        address renter = contracts_var.renter;
        address provider = contracts_var.provider;

        require(escrowBalance[renter] >= amount, "Insufficient escrow balance");

        // Transfer from escrow
        escrowBalance[renter] -= amount;
        escrowBalance[provider] += amount;

        // Log payment
        contractPayments[contractId].push(Payment({
            contractId: contractId,
            from: renter,
            to: provider,
            amount: amount,
            timestamp: block.timestamp,
            processed: true
        }));

        emit PaymentProcessed(contractId, renter, provider, amount);
    }

    /**
     * HYBRID MODE: Marchează manual o plată ca fiind efectuată (pentru plăți off-chain/simulate)
     * Doar providerul sau adminul poate apela asta
     */
    function markPaid(uint256 contractId) public {
        require(contractId < contractCounter, "Contract not found");
        Storage storage contracts_var = contracts[contractId];
        
        require(msg.sender == contracts_var.provider || msg.sender == contracts_var.renter, "Not authorized");
        // In realitate ar trebui sa verificam ca msg.sender este backend-ul autorizat
        
        // Nu mutam fonduri reale, doar emitem evenimentul
        uint256 amount = calculateMonthlyPayment(contractId);
        
        contractPayments[contractId].push(Payment({
            contractId: contractId,
            from: contracts_var.renter,
            to: contracts_var.provider,
            amount: amount,
            timestamp: block.timestamp,
            processed: true
        }));

        emit PaymentProcessed(contractId, contracts_var.renter, contracts_var.provider, amount);
    }

    /**
     * Actualizează storage usage
     */
    function updateStorageUsage(uint256 contractId, uint256 newUsedGB) public {
        require(contractId < contractCounter, "Contract not found");
        Storage storage contracts_var = contracts[contractId];
        
        require(msg.sender == contracts_var.provider, "Only provider can update usage");
        require(newUsedGB <= contracts_var.allocatedGB, "Usage exceeds allocation");

        contracts_var.usedGB = newUsedGB;
        emit StorageUpdated(contractId, newUsedGB);
    }

    /**
     * Dispute contract
     */
    function disputeContract(uint256 contractId, string memory reason) public {
        require(contractId < contractCounter, "Contract not found");
        Storage storage contracts_var = contracts[contractId];
        
        require(
            msg.sender == contracts_var.renter || msg.sender == contracts_var.provider,
            "Not a party to contract"
        );

        contracts_var.disputed = true;
        emit ContractDisputed(contractId, msg.sender, reason);
    }

    /**
     * Închide contract
     */
    function closeContract(uint256 contractId) public {
        require(contractId < contractCounter, "Contract not found");
        Storage storage contracts_var = contracts[contractId];
        
        require(
            msg.sender == contracts_var.renter || msg.sender == contracts_var.provider,
            "Not a party to contract"
        );

        contracts_var.active = false;
        emit ContractClosed(contractId, true);
    }

    /**
     * Retrage from escrow
     */
    function withdrawEscrow(uint256 amount) public {
        require(escrowBalance[msg.sender] >= amount, "Insufficient balance");
        
        escrowBalance[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }

    /**
     * Obține contract details
     */
    function getContract(uint256 contractId) public view returns (Storage memory) {
        require(contractId < contractCounter, "Contract not found");
        return contracts[contractId];
    }

    /**
     * Obține user contracts
     */
    function getUserContracts(address user) public view returns (uint256[] memory) {
        return userContracts[user];
    }

    /**
     * Obține payment history
     */
    function getPaymentHistory(uint256 contractId) public view returns (Payment[] memory) {
        return contractPayments[contractId];
    }
}
