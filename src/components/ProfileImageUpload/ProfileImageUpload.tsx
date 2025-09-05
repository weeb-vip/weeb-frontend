import React, { useState, useRef, useCallback } from 'react';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { uploadProfileImage } from '../../services/api/upload';
import Button, { ButtonColor } from '../Button';
import debug from '../../utils/debug';

interface ProfileImageUploadProps {
  isOpen: boolean;
  onClose: () => void;
  currentImageUrl?: string | null;
}

export function ProfileImageUpload({ isOpen, onClose, currentImageUrl }: ProfileImageUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cropData, setCropData] = useState({ x: 0, y: 0, size: 200 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const queryClient = useQueryClient();

  const uploadMutation = useMutation({
    mutationFn: async (croppedBlob: Blob) => {
      debug.info('Starting profile image upload...', { 
        blobSize: croppedBlob.size, 
        blobType: croppedBlob.type 
      });
      
      const file = new File([croppedBlob], 'profile.jpg', { type: 'image/jpeg' });
      debug.info('Created file from blob:', { 
        name: file.name, 
        type: file.type, 
        size: file.size 
      });
      
      return await uploadProfileImage(file);
    },
    onSuccess: (data) => {
      debug.success('Profile image uploaded successfully', data);
      queryClient.setQueryData(['user'], data);
      queryClient.invalidateQueries({ queryKey: ['user'] });
      onClose();
      resetState();
    },
    onError: (error: any) => {
      debug.error('Failed to upload profile image:', error);
    }
  });

  const resetState = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setCropData({ x: 0, y: 0, size: 200 });
    setImageSize({ width: 0, height: 0 });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const url = e.target?.result as string;
        setPreviewUrl(url);
        
        // Load image to get dimensions
        const img = new Image();
        img.onload = () => {
          // Scale image dimensions to fit within container
          const containerMaxWidth = window.innerWidth > 640 ? 600 : window.innerWidth - 80; // Account for padding
          const containerMaxHeight = window.innerHeight * 0.5; // 50% of viewport height
          
          let displayWidth = img.width;
          let displayHeight = img.height;
          
          // Scale down if image is too large
          if (displayWidth > containerMaxWidth || displayHeight > containerMaxHeight) {
            const scale = Math.min(containerMaxWidth / displayWidth, containerMaxHeight / displayHeight);
            displayWidth *= scale;
            displayHeight *= scale;
          }
          
          setImageSize({ width: displayWidth, height: displayHeight });
          const maxDimension = Math.max(displayWidth, displayHeight);
          const cropSize = Math.min(maxDimension, 300); // Can contain full image, max 300px
          setCropData({ 
            x: (displayWidth - cropSize) / 2, 
            y: (displayHeight - cropSize) / 2, 
            size: cropSize 
          });
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        setPreviewUrl(url);
        
        const img = new Image();
        img.onload = () => {
          // Scale image dimensions to fit within container
          const containerMaxWidth = window.innerWidth > 640 ? 600 : window.innerWidth - 80;
          const containerMaxHeight = window.innerHeight * 0.5;
          
          let displayWidth = img.width;
          let displayHeight = img.height;
          
          if (displayWidth > containerMaxWidth || displayHeight > containerMaxHeight) {
            const scale = Math.min(containerMaxWidth / displayWidth, containerMaxHeight / displayHeight);
            displayWidth *= scale;
            displayHeight *= scale;
          }
          
          setImageSize({ width: displayWidth, height: displayHeight });
          const maxDimension = Math.max(displayWidth, displayHeight);
          const cropSize = Math.min(maxDimension, 300); // Can contain full image, max 300px
          setCropData({ 
            x: (displayWidth - cropSize) / 2, 
            y: (displayHeight - cropSize) / 2, 
            size: cropSize 
          });
        };
        img.src = url;
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleStart = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    setDragStart({ x: clientX - cropData.x, y: clientY - cropData.y });
  };

  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const newX = Math.max(0, Math.min(clientX - dragStart.x, imageSize.width - cropData.size));
    const newY = Math.max(0, Math.min(clientY - dragStart.y, imageSize.height - cropData.size));
    
    setCropData(prev => ({ ...prev, x: newX, y: newY }));
  };

  const handleEnd = () => {
    setIsDragging(false);
  };

  const handleSizeChange = (newSize: number) => {
    const maxSize = Math.max(imageSize.width, imageSize.height); // Allow full image coverage
    const minSize = Math.min(imageSize.width, imageSize.height) * 0.5; // Minimum 50% of smaller dimension
    const size = Math.max(minSize, Math.min(newSize, maxSize));
    const maxX = Math.max(0, imageSize.width - size);
    const maxY = Math.max(0, imageSize.height - size);
    
    setCropData(prev => ({
      size,
      x: Math.min(prev.x, maxX),
      y: Math.min(prev.y, maxY)
    }));
  };

  const cropAndUpload = async () => {
    if (!previewUrl || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Set canvas size to desired output size (square for circular crop)
      canvas.width = 400;
      canvas.height = 400;

      // Calculate scale factors
      const displayToOriginalScaleX = img.width / imageSize.width;
      const displayToOriginalScaleY = img.height / imageSize.height;
      
      // Calculate original image crop coordinates
      const originalCropX = cropData.x * displayToOriginalScaleX;
      const originalCropY = cropData.y * displayToOriginalScaleY;
      const originalCropSize = cropData.size * Math.min(displayToOriginalScaleX, displayToOriginalScaleY);

      // Create circular clipping path
      ctx.save();
      ctx.beginPath();
      ctx.arc(200, 200, 200, 0, Math.PI * 2);
      ctx.clip();

      // Draw cropped and scaled image within the circular clip
      ctx.drawImage(
        img,
        originalCropX, originalCropY, originalCropSize, originalCropSize,
        0, 0, 400, 400
      );

      ctx.restore();

      // Convert to blob and upload
      canvas.toBlob((blob) => {
        if (blob) {
          uploadMutation.mutate(blob);
        }
      }, 'image/jpeg', 0.9);
    };
    img.src = previewUrl;
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl max-h-[90vh] transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-4 sm:p-6 text-left align-middle shadow-xl transition-all flex flex-col">
                <Dialog.Title
                  as="h3"
                  className="text-lg font-medium leading-6 text-gray-900 dark:text-gray-100 mb-4"
                >
                  Upload Profile Picture
                </Dialog.Title>

                <div className="flex-1 overflow-y-auto">
                  {!previewUrl ? (
                    <div
                      className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 sm:p-8 text-center cursor-pointer hover:border-blue-500 dark:hover:border-blue-400 transition-colors"
                      onDrop={handleDrop}
                      onDragOver={(e) => e.preventDefault()}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <svg className="mx-auto h-8 w-8 sm:h-12 sm:w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                        <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        Tap to upload or drag and drop
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        PNG, JPG, GIF up to 10MB
                      </p>
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept="image/*"
                        onChange={handleFileSelect}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex justify-center">
                        <div 
                          className="relative select-none"
                          onMouseMove={handleMove}
                          onMouseUp={handleEnd}
                          onMouseLeave={handleEnd}
                          onTouchMove={handleMove}
                          onTouchEnd={handleEnd}
                          style={{ 
                            width: `${imageSize.width}px`, 
                            height: `${imageSize.height}px`,
                            maxWidth: '100%'
                          }}
                        >
                          <img
                            src={previewUrl}
                            alt="Preview"
                            className="block"
                            style={{ 
                              width: `${imageSize.width}px`, 
                              height: `${imageSize.height}px` 
                            }}
                            draggable={false}
                          />
                          {/* Circular crop area */}
                          <div
                            className="absolute border-2 border-white shadow-lg pointer-events-none rounded-full"
                            style={{
                              left: `${cropData.x}px`,
                              top: `${cropData.y}px`,
                              width: `${cropData.size}px`,
                              height: `${cropData.size}px`,
                            }}
                          >
                            <div className="absolute inset-0 border border-dashed border-white/50 rounded-full" />
                            <div
                              className="absolute inset-0 cursor-move pointer-events-auto touch-manipulation rounded-full"
                              onMouseDown={handleStart}
                              onTouchStart={handleStart}
                            />
                          </div>
                          {/* Circular overlay for darkening outside crop */}
                          <div 
                            className="absolute inset-0 pointer-events-none"
                            style={{
                              background: `radial-gradient(circle at ${cropData.x + cropData.size/2}px ${cropData.y + cropData.size/2}px, transparent ${cropData.size/2}px, rgba(0,0,0,0.5) ${cropData.size/2}px)`
                            }}
                          />
                        </div>
                      </div>

                      <div className="space-y-4 px-4">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block text-center">
                          Crop Size: {Math.round(cropData.size)}px
                        </label>
                        <div className="px-6 py-4">
                          <div className="relative bg-gray-200 dark:bg-gray-600 h-6 rounded-full">
                            {/* Progress track */}
                            <div 
                              className="absolute top-0 left-0 h-full bg-blue-500 rounded-full"
                              style={{ 
                                width: `${((cropData.size - Math.min(imageSize.width, imageSize.height) * 0.5) / (Math.max(imageSize.width, imageSize.height) - Math.min(imageSize.width, imageSize.height) * 0.5)) * 100}%` 
                              }}
                            />
                            {/* Hidden native slider */}
                            <input
                              type="range"
                              min={Math.min(imageSize.width, imageSize.height) * 0.5}
                              max={Math.max(imageSize.width, imageSize.height)}
                              value={cropData.size}
                              onChange={(e) => handleSizeChange(Number(e.target.value))}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            />
                            {/* Custom thumb */}
                            <div 
                              className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 border-4 border-white rounded-full shadow-lg pointer-events-none"
                              style={{ 
                                left: `${((cropData.size - Math.min(imageSize.width, imageSize.height) * 0.5) / (Math.max(imageSize.width, imageSize.height) - Math.min(imageSize.width, imageSize.height) * 0.5)) * 100}%`,
                                transform: 'translateX(-50%) translateY(-50%)'
                              }}
                            />
                          </div>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          Drag the circle above to position, or use the slider to resize
                        </p>
                      </div>

                      <div className="flex justify-center">
                        <Button
                          color={ButtonColor.transparent}
                          label="Choose Different Image"
                          onClick={() => {
                            resetState();
                            fileInputRef.current?.click();
                          }}
                          showLabel
                        />
                      </div>
                    </div>
                  )}
                </div>

                <canvas ref={canvasRef} className="hidden" />

                <div className="mt-6 flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3">
                  <Button
                    color={ButtonColor.transparent}
                    label="Cancel"
                    onClick={() => {
                      onClose();
                      resetState();
                    }}
                    showLabel
                    className="w-full sm:w-auto"
                  />
                  {previewUrl && (
                    <Button
                      color={ButtonColor.blue}
                      label={uploadMutation.isLoading ? "Uploading..." : "Upload"}
                      onClick={cropAndUpload}
                      showLabel
                      className="w-full sm:w-auto"
                    />
                  )}
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}