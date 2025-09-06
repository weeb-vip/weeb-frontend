import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faX, faClock, faPlay } from '@fortawesome/free-solid-svg-icons';
import { GetImageFromAnime } from '../../services/utils';
import { SafeImage } from "../SafeImage/SafeImage";
import { useNavigate } from 'react-router-dom';
import { ToastProps } from './Toast';

const MobileToast: React.FC<ToastProps> = ({
  id,
  type,
  title,
  message,
  duration = 6000,
  onClose,
  anime
}) => {
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Slide in animation
    setTimeout(() => setIsVisible(true), 50);

    // Auto-hide after duration
    const timeout = setTimeout(() => {
      setIsVisible(false);
      setTimeout(() => onClose(id), 300);
    }, duration);

    return () => clearTimeout(timeout);
  }, [id, duration, onClose]);

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
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
        return <FontAwesomeIcon icon={faClock} className="w-4 h-4" />;
      case 'info':
        return <FontAwesomeIcon icon={faPlay} className="w-4 h-4" />;
      case 'success':
        return <FontAwesomeIcon icon={faPlay} className="w-4 h-4" />;
      default:
        return null;
    }
  };

  const getColorClasses = () => {
    switch (type) {
      case 'warning':
        return {
          container: 'bg-white/90 dark:bg-black/60 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700',
          icon: 'text-yellow-500',
          title: 'text-gray-900 dark:text-white',
          message: 'text-gray-600 dark:text-gray-200',
          close: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
        };
      case 'info':
        return {
          container: 'bg-white/90 dark:bg-black/60 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700',
          icon: 'text-blue-500',
          title: 'text-gray-900 dark:text-white',
          message: 'text-gray-600 dark:text-gray-200',
          close: 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'
        };
      case 'success':
        return {
          container: 'bg-white/90 dark:bg-black/60 backdrop-blur-sm border-b border-gray-200 dark:border-gray-700',
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
        fixed top-0 left-0 right-0 z-30 transition-all duration-300 ease-out
        ${isVisible ? 'translate-y-[5.5rem]' : '-translate-y-full opacity-0'}
        ${anime ? 'cursor-pointer' : ''}
      `}
      onClick={anime ? handleToastClick : undefined}
    >
      {/* Background with blur - similar to sticky header */}
      <div className="relative overflow-hidden">
        {/* Background image if anime has one */}
        {anime && (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-20"
            style={{
              backgroundImage: `url(${global.config.cdn_url}/${GetImageFromAnime(anime)})`,
              filter: 'blur(8px)',
              transform: 'scale(1.1)',
            }}
          />
        )}

        {/* Overlay */}
        <div className={`absolute inset-0 ${colors.container}`} />

        {/* Content */}
        <div className="max-w-screen-2xl mx-auto relative z-10 px-4 py-3">
          <div className="flex items-center gap-3">
            {/* Poster Image */}
            {anime && (
              <div className="flex-shrink-0">
                <SafeImage
                  src={GetImageFromAnime(anime)}
                  alt={anime.titleEn || anime.titleJp || 'Anime Poster'}
                  className="w-8 h-12 rounded object-cover border border-white/20 dark:border-white/10"
                  onError={({currentTarget}) => {
                    currentTarget.onerror = null;
                    currentTarget.src = "/assets/not found.jpg";
                  }}
                />
              </div>
            )}

            {/* Content */}
            <div className="min-w-0 flex-1">
              {/* Notification Title */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <div className={`flex-shrink-0 ${colors.icon} flex items-center`}>
                  {getIcon()}
                </div>
                <p className={`text-xs font-semibold ${colors.title} uppercase tracking-wide`}>
                  {title}
                </p>
              </div>

              {/* Anime Title */}
              {anime && (
                <h1 className={`text-sm font-bold ${colors.title} truncate mb-0.5`}>
                  {anime.titleEn || anime.titleJp}
                </h1>
              )}

              {/* Episode Info */}
              <p className={`text-xs ${colors.message} truncate`}>
                {message}
              </p>
            </div>

            {/* Close Button */}
            <button
              onClick={handleClose}
              className={`
                flex-shrink-0 p-2 rounded-full transition-all duration-200
                ${colors.close} hover:bg-gray-100 dark:hover:bg-gray-700/50
                hover:scale-110 active:scale-95
              `}
            >
              <FontAwesomeIcon icon={faX} className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MobileToast;
