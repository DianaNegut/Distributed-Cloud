FROM ipfs/kubo:latest

# Copiază swarm.key în container
COPY swarm.key /data/ipfs/swarm.key

# Setează permisiuni
RUN chmod 400 /data/ipfs/swarm.key

# Forțează folosirea rețelei private
ENV LIBP2P_FORCE_PNET=1

# Script de inițializare
COPY init-test-peer.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/init-test-peer.sh

ENTRYPOINT ["/usr/local/bin/init-test-peer.sh"]
