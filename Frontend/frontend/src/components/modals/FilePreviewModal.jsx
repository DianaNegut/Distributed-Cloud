import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileIcon, Image as ImageIcon, FileText, Film, Music, Archive } from 'lucide-react';

const FilePreviewModal = ({ isOpen, onClose, file, onDownload }) => {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (isOpen && file) {
      loadPreview();
    }
    return () => {
      if (previewData && typeof previewData === 'string') {
        URL.revokeObjectURL(previewData);
      }
    };
  }, [isOpen, file]);

  const getFileType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['mp4', 'webm', 'ogg'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
    if (['txt', 'md', 'json', 'xml', 'csv'].includes(ext)) return 'text';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'unknown';
  };

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const fileType = getFileType(file.name);
      
      if (fileType === 'image' || fileType === 'video' || fileType === 'audio') {
        // For media files, create a blob URL
        const response = await fetch(`http://localhost:3001/api/dockerCluster/cat/${file.cid}`);
        if (!response.ok) throw new Error('Failed to load file');
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setPreviewData(url);
      } else if (fileType === 'text') {
        // For text files, load content as text
        const response = await fetch(`http://localhost:3001/api/dockerCluster/cat/${file.cid}`);
        if (!response.ok) throw new Error('Failed to load file');
        
        const text = await response.text();
        setPreviewData(text);
      } else if (fileType === 'pdf') {
        // For PDF, we'll use an iframe
        const url = `http://localhost:3001/api/dockerCluster/cat/${file.cid}`;
        setPreviewData(url);
      } else {
        setPreviewData(null);
      }
    } catch (err) {
      console.error('Error loading preview:', err);
      setError('Unable to load preview');
    } finally {
      setLoading(false);
    }
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
        </div>
      );
    }

    if (error) {
      return (
        <div className="flex items-center justify-center h-96 text-red-500">
          <p>{error}</p>
        </div>
      );
    }

    const fileType = getFileType(file.name);

    switch (fileType) {
      case 'image':
        return (
          <div className="flex items-center justify-center p-4 bg-gray-50">
            <img
              src={previewData}
              alt={file.name}
              className="max-w-full max-h-[600px] object-contain rounded"
            />
          </div>
        );

      case 'video':
        return (
          <div className="flex items-center justify-center p-4 bg-gray-900">
            <video
              src={previewData}
              controls
              className="max-w-full max-h-[600px] rounded"
            >
              Your browser does not support video playback.
            </video>
          </div>
        );

      case 'audio':
        return (
          <div className="flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-pink-50">
            <Music className="w-24 h-24 text-purple-400 mb-4" />
            <audio src={previewData} controls className="w-full max-w-md" />
          </div>
        );

      case 'text':
        return (
          <div className="p-4 bg-gray-50 max-h-[600px] overflow-auto">
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800">
              {previewData}
            </pre>
          </div>
        );

      case 'pdf':
        return (
          <div className="h-[600px]">
            <iframe
              src={previewData}
              className="w-full h-full border-0"
              title={file.name}
            />
          </div>
        );

      case 'archive':
        return (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <Archive className="w-24 h-24 mb-4" />
            <p className="text-lg font-medium">Archive File</p>
            <p className="text-sm mt-2">Preview not available for archive files</p>
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center h-96 text-gray-500">
            <FileIcon className="w-24 h-24 mb-4" />
            <p className="text-lg font-medium">Preview Not Available</p>
            <p className="text-sm mt-2">This file type cannot be previewed</p>
          </div>
        );
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileIcon = () => {
    const fileType = getFileType(file?.name || '');
    switch (fileType) {
      case 'image': return ImageIcon;
      case 'video': return Film;
      case 'audio': return Music;
      case 'text':
      case 'pdf': return FileText;
      case 'archive': return Archive;
      default: return FileIcon;
    }
  };

  const FileTypeIcon = getFileIcon();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b bg-gradient-to-r from-purple-500 to-pink-500 text-white">
              <div className="flex items-center space-x-3">
                <FileTypeIcon className="w-6 h-6" />
                <div>
                  <h3 className="font-semibold text-lg">{file?.name}</h3>
                  <p className="text-sm text-purple-100">
                    {file?.size && formatSize(file.size)} • CID: {file?.cid?.substring(0, 12)}...
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onDownload(file)}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                  title="Download"
                >
                  <Download className="w-5 h-5" />
                </button>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Preview Area */}
            <div className="overflow-auto max-h-[calc(90vh-80px)]">
              {renderPreview()}
            </div>

            {/* Footer with metadata */}
            {file && (
              <div className="p-4 border-t bg-gray-50 text-sm text-gray-600">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="font-semibold">Uploaded:</span>{' '}
                    {file.addedAt ? new Date(file.addedAt).toLocaleString() : 'Unknown'}
                  </div>
                  <div>
                    <span className="font-semibold">Type:</span>{' '}
                    {getFileType(file.name).toUpperCase()}
                  </div>
                  {file.encryption?.encrypted && (
                    <div className="col-span-2 flex items-center text-green-600">
                      <span className="font-semibold">🔒 Encrypted</span>
                      <span className="ml-2 text-xs text-gray-500">
                        (Original: {file.encryption.originalName})
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FilePreviewModal;
