const fs = require('fs');
const path = require('path');
const StorageProvider = require('./models/StorageProvider');
const StorageContract = require('./models/StorageContract');

const provider = StorageProvider.registerProvider({
  peerId: 'peer-test-2',
  name: 'Provider Real',
  totalCapacityGB: 10,
  uptimeGuarantee: 99.9,
  location: 'Test'
});
console.log('Provider creat:', provider);

const contract = StorageContract.createContract({
  renterId: 'renter-real',
  renterName: 'Renter Real',
  providerId: provider.id,
  providerName: provider.name,
  allocatedGB: 1,
  durationMonths: 1
});
console.log('Contract creat:', contract);

const filePath = path.resolve(__dirname, '../Frontend/frontend/src/pages/test.txt');
const stats = fs.statSync(filePath);
const fileData = {
  cid: 'cid-test-123',
  name: path.basename(filePath),
  sizeBytes: stats.size,
  mimetype: 'text/plain'
};

const addResult = StorageContract.addFileToContract(contract.id, fileData);
console.log('Rezultat adaugare fisier:', addResult);

const updatedContract = StorageContract.getContract(contract.id);
console.log('Contract actualizat:', updatedContract);