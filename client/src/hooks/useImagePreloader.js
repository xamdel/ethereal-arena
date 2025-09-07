import { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Custom hook for preloading images and coordinating their loading states
 * @param {string[]} imageUrls - Array of image URLs to preload
 * @returns {Object} - { allLoaded, loadingProgress, loadedImages, errors }
 */
export function useImagePreloader(imageUrls) {
  const [allLoaded, setAllLoaded] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadedImages, setLoadedImages] = useState([]);
  const [errors, setErrors] = useState([]);
  const isLoadingRef = useRef(false);

  // Memoize the URLs array to prevent unnecessary re-renders
  const memoizedUrls = useMemo(() => {
    if (!imageUrls || imageUrls.length === 0) return [];
    return [...imageUrls];
  }, [imageUrls]);

  // Create a stable string key for the URLs to detect actual changes
  const urlsKey = useMemo(() => {
    return memoizedUrls.join('|');
  }, [memoizedUrls]);

  useEffect(() => {
    // Prevent multiple simultaneous loading attempts
    if (isLoadingRef.current) return;

    if (!memoizedUrls || memoizedUrls.length === 0) {
      setAllLoaded(true);
      setLoadingProgress(100);
      setLoadedImages([]);
      setErrors([]);
      return;
    }

    // Reset states when URLs change
    setAllLoaded(false);
    setLoadingProgress(0);
    setLoadedImages([]);
    setErrors([]);
    isLoadingRef.current = true;

    let loadedCount = 0;
    let errorCount = 0;
    const totalImages = memoizedUrls.length;

    const preloadImage = (url, index) => {
      return new Promise((resolve) => {
        const img = new Image();
        const startTime = performance.now();
        
        img.onload = () => {
          const duration = performance.now() - startTime;
          console.log(`[ImagePreloader] Loaded image ${index + 1}: ${url} in ${duration.toFixed(2)}ms`);
          loadedCount++;
          setLoadedImages(prev => [...prev, { url, index, loaded: true }]);
          setLoadingProgress((loadedCount / totalImages) * 100);
          
          if (loadedCount + errorCount === totalImages) {
            setAllLoaded(true);
            isLoadingRef.current = false;
          }
          resolve({ url, index, success: true });
        };

        img.onerror = () => {
          const duration = performance.now() - startTime;
          console.error(`[ImagePreloader] Failed to load image ${index + 1}: ${url} after ${duration.toFixed(2)}ms`);
          errorCount++;
          setErrors(prev => [...prev, { url, index, error: 'Failed to load' }]);
          setLoadingProgress(((loadedCount + errorCount) / totalImages) * 100);
          
          if (loadedCount + errorCount === totalImages) {
            setAllLoaded(true);
            isLoadingRef.current = false;
          }
          resolve({ url, index, success: false });
        };

        img.src = url;
      });
    };

    // Start preloading all images
    const preloadPromises = memoizedUrls.map((url, index) => preloadImage(url, index));
    
    Promise.all(preloadPromises).then(() => {
      console.log(`[ImagePreloader] Finished preloading ${totalImages} images. Loaded: ${loadedCount}, Errors: ${errorCount}`);
    }).catch((error) => {
      console.error('[ImagePreloader] Error during preloading:', error);
      isLoadingRef.current = false;
    });

    // Cleanup function
    return () => {
      isLoadingRef.current = false;
    };

  }, [urlsKey]); // Use the stable key instead of the array

  return {
    allLoaded,
    loadingProgress,
    loadedImages,
    errors,
    hasErrors: errors.length > 0
  };
}