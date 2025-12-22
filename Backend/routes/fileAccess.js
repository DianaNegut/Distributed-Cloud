

const express = require('express');
const router = express.Router();
const fileOwnership = require('../models/FileOwnership');
const { requireAuth } = require('../middleware/solidAuth');


router.get('/my-files', requireAuth, (req, res) => {
  try {
    const webId = req.session?.webId;
    if (!webId) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }

    const ownedFiles = fileOwnership.getOwnedFiles(webId);
    const accessibleFiles = fileOwnership.getAccessibleFiles(webId);

    res.json({
      success: true,
      owned: ownedFiles,
      accessible: accessibleFiles.filter(f => !f.isOwner),
      total: {
        owned: ownedFiles.length,
        accessible: accessibleFiles.filter(f => !f.isOwner).length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


router.get('/info/:cid', requireAuth, (req, res) => {
  try {
    const { cid } = req.params;
    const webId = req.session?.webId;

    const fileInfo = fileOwnership.getFileInfo(cid);
    if (!fileInfo) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    const canAccess = fileOwnership.canAccess(cid, webId);
    if (!canAccess) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    res.json({
      success: true,
      file: {
        cid,
        ...fileInfo,
        isOwner: fileOwnership.isOwner(cid, webId),
        canAccess
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


router.post('/share', requireAuth, (req, res) => {
  try {
    const { cid, targetWebId } = req.body;
    const webId = req.session?.webId;

    if (!cid || !targetWebId) {
      return res.status(400).json({
        success: false,
        error: 'cid and targetWebId required'
      });
    }

    const success = fileOwnership.grantAccess(cid, webId, targetWebId);
    if (!success) {
      return res.status(403).json({
        success: false,
        error: 'Only owner can grant access'
      });
    }

    res.json({
      success: true,
      message: `Access granted to ${targetWebId}`,
      file: fileOwnership.getFileInfo(cid)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


router.post('/revoke', requireAuth, (req, res) => {
  try {
    const { cid, targetWebId } = req.body;
    const webId = req.session?.webId;

    if (!cid || !targetWebId) {
      return res.status(400).json({
        success: false,
        error: 'cid and targetWebId required'
      });
    }

    const success = fileOwnership.revokeAccess(cid, webId, targetWebId);
    if (!success) {
      return res.status(403).json({
        success: false,
        error: 'Only owner can revoke access or target is owner'
      });
    }

    res.json({
      success: true,
      message: `Access revoked from ${targetWebId}`,
      file: fileOwnership.getFileInfo(cid)
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


router.delete('/delete/:cid', requireAuth, async (req, res) => {
  try {
    const { cid } = req.params;
    const webId = req.session?.webId;

    if (!fileOwnership.isOwner(cid, webId)) {
      return res.status(403).json({
        success: false,
        error: 'Only owner can delete file'
      });
    }

    const deleted = fileOwnership.deleteFile(cid, webId);
    if (!deleted) {
      return res.status(500).json({
        success: false,
        error: 'Failed to delete file ownership record'
      });
    }

    res.json({
      success: true,
      message: `File ${cid} deleted successfully`,
      cid
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});


router.get('/check-access/:cid', requireAuth, (req, res) => {
  try {
    const { cid } = req.params;
    const webId = req.session?.webId;

    const canAccess = fileOwnership.canAccess(cid, webId);
    const isOwner = fileOwnership.isOwner(cid, webId);
    const fileInfo = fileOwnership.getFileInfo(cid);

    res.json({
      success: true,
      canAccess,
      isOwner,
      exists: !!fileInfo
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
