const DIDService = require('../models/DecentralizedIdentity');
const StorageService = require('../models/StorageContract');
require('dotenv').config();

async function main() {
    console.log('--- START INTERGRATION TEST ---');

    try {
        // 1. Test DID Registration
        console.log('\n[TEST] 1. Registering DID...');
        const didData = DIDService.generateDID('user-test');
        console.log('Generated DID:', didData.did);

        // CID fictiv pentru test
        const mockCID = 'bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi';

        const regResult = await DIDService.registerDIDOnChain(didData.did, mockCID);
        console.log('DID Registration Result:', regResult);

        if (!regResult.success) throw new Error('DID Registration Failed');

        // 2. Test Storage Contract Creation
        console.log('\n[TEST] 2. Creating Storage Contract...');
        const contractData = {
            providerId: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', // Account #0 (implied, or hardcoded for test)
            allocatedGB: 100,
            pricePerGBPerMonth: 0.01,
            durationMonths: 6,
            renterId: 'test-renter'
        };

        const createResult = await StorageService.createContract(contractData);
        console.log('Storage Contract Result:', createResult);

        if (!createResult.success) throw new Error('Storage Contract Creation Failed');

        console.log('\n--- INTEGRATION TEST PASSED ---');
        console.log('Contracts are reachable and working correctly on Localhost.');

    } catch (error) {
        console.error('\n[FAIL] Integration Verification Failed:', error);
        process.exit(1);
    }
}

main();
