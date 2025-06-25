#!/bin/sh
set -e

# Verifică dacă repository-ul IPFS există. Dacă nu, îl inițializează.
if [ -e /data/ipfs/config ]; then
  echo "Repository-ul IPFS a fost deja inițializat."
else
  echo "Inițializare repository IPFS..."
  ipfs init --profile server
fi

# Setează API-ul și Gateway-ul să asculte pe toate interfețele
echo "Configurare adrese API și Gateway..."
ipfs config Addresses.API /ip4/0.0.0.0/tcp/5001
ipfs config Addresses.Gateway /ip4/0.0.0.0/tcp/8080

# Șterge TOATE nodurile de bootstrap default. Acest pas este CRUCIAL pentru o rețea privată.
echo "Ștergere noduri de bootstrap default..."
ipfs bootstrap rm --all

# Adaugă nodurile de bootstrap custom, dacă sunt definite în variabila de mediu
if [ -n "$CUSTOM_BOOTSTRAP_NODE" ]; then
  echo "Adăugare nod de bootstrap custom: $CUSTOM_BOOTSTRAP_NODE"
  ipfs bootstrap add "$CUSTOM_BOOTSTRAP_NODE"
fi

# Pornește daemon-ul IPFS. 'exec' înlocuiește procesul scriptului cu cel al daemon-ului.
echo "Pornire daemon IPFS..."
exec ipfs daemon