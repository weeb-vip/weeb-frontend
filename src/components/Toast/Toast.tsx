import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faX, faClock, faPlay } from '@fortawesome/free-solid-svg-icons';
import { GetImageFromAnime } from '../../services/utils';
import {SafeImage} from "../SafeImage/SafeImage";
import { useNavigate } from 'react-router-dom';

export interface ToastProps {
  id: string;
  type: 'warning' | 'info' | 'success';
  title: string;
  message: string;
  duration?: number;
  onClose: (id: string) => void;
  anime?: {
    id: string;
    titleEn?: string | null;
    titleJp?: string | null;
    imageUrl?: string | null;
  };
}

const Toast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 6000,
  onClose,
  anime
}) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const updateProgress = () => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, (duration - elapsed) / duration * 100);
      setProgress(remaining);

      if (remaining > 0) {
        requestAnimationFrame(updateProgress);
      } else {
        setIsVisible(false);
        setTimeout(() => onClose(id), 300); // Wait for exit animation
      }
    };

    const animationFrame = requestAnimationFrame(updateProgress);
    return () => cancelAnimationFrame(animationFrame);
  }, [id, duration, onClose]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent navigation when clicking close button
    setIsVisible(false);
    setTimeout(() => onClose(id), 300);
  };

  const handleToastClick = () => {
    if (anime) {
      navigate(`/show/${anime.id}`);
    }
  };

  const getIcon = () => {
    switch (type) {
      case 'warning':
        return <FontAwesomeIcon icon={faClock} className="w-5 h-5" />;
      case 'info':
        return <FontAwesomeIcon icon={faPlay} className="w-5 h-5" />;
      case 'success':
        return <FontAwesomeIcon icon={faPlay} className="w-5 h-5" />;
      default:
        return null;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'warning':
        return {
          container: 'bg-white/90 dark:bg-black/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700',
          icon: 'text-yellow-500',
          title: 'text-gray-900 dark:text-white',
          message: 'text-gray-600 dark:text-gray-200',
          close: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
        };
      case 'info':
        return {
          container: 'bg-white/90 dark:bg-black/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700',
          icon: 'text-blue-500',
          title: 'text-gray-900 dark:text-white',
          message: 'text-gray-600 dark:text-gray-200',
          close: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
        };
      case 'success':
        return {
          container: 'bg-white/90 dark:bg-black/60 backdrop-blur-sm border border-gray-200 dark:border-gray-700',
          icon: 'text-green-500',
          title: 'text-gray-900 dark:text-white',
          message: 'text-gray-600 dark:text-gray-200',
          close: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
        };
    }
  };

  const colors = getColorClasses();

  return (
    <div
      className={`
        transform transition-all duration-500 ease-out mb-3 max-w-xs w-full
        ${isVisible 
          ? 'translate-x-0 opacity-100 scale-100' 
          : 'translate-x-full opacity-0 scale-95'
        }
      `}
    >
      <div 
        className={`
          ${colors.container} 
          rounded-lg shadow-md overflow-hidden
          transition-all duration-300
          ${anime ? 'cursor-pointer hover:scale-105' : ''}
        `}
        onClick={anime ? handleToastClick : undefined}
      >
        <div className="p-3">
          {/* Top Title */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <div className={`flex-shrink-0 ${colors.icon} flex items-center`}>
                {getIcon()}
              </div>
              <p className={`text-xs font-semibold ${colors.title} uppercase tracking-wide flex items-center`}>
                {title}
              </p>
            </div>
            <button
              onClick={handleClose}
              className={`
                flex-shrink-0 p-1 rounded-full transition-all duration-200
                ${colors.close} hover:bg-gray-100 dark:hover:bg-gray-700/50
                hover:scale-110 active:scale-95
              `}
            >
              <FontAwesomeIcon icon={faX} className="w-2.5 h-2.5" />
            </button>
          </div>

          {/* Content with Image and Text */}
          <div className="flex items-center gap-3">
            {/* Poster Image */}
            {anime && (
              <div className="flex-shrink-0">
                <SafeImage
                  src={GetImageFromAnime(anime)}
                  alt={anime.titleEn || anime.titleJp || 'Anime Poster'}
                  className="w-12 h-16 rounded-lg object-cover border border-white/20 dark:border-white/10"
                  onError={({currentTarget}) => {
                    currentTarget.onerror = null; // prevents looping
                    currentTarget.src = "/assets/not found.jpg";
                  }}
                />
              </div>
            )}

            {/* Text Content */}
            <div className="flex-1 min-w-0">
              {/* Anime Title */}
              {anime && (
                <p className={`text-sm font-bold ${colors.title} truncate mb-0.5`}>
                  {anime.titleEn || anime.titleJp}
                </p>
              )}

              {/* Episode Info */}
              <p className={`text-xs ${colors.message} truncate`}>
                {message}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Toast;
