import React, { useState } from 'react';

interface ProfileAvatarProps {
  username?: string;
  profileImageUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';
  linkToProfile?: boolean;
  className?: string;
}

export function ProfileAvatar({
  username = '',
  profileImageUrl,
  size = 'md',
  linkToProfile = true,
  className = ''
}: ProfileAvatarProps) {
  const [imageError, setImageError] = useState(false);

  const getInitial = () => {
    if (!username) return '?';
    return username.charAt(0).toUpperCase();
  };

  const sizeClasses = {
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-16 h-16 text-xl'
  };

  const getImageUrl = (): string | undefined => {
    if (!profileImageUrl) return undefined;
    const suffix = size === 'lg' ? '_64' : '_32';
    // Insert suffix before file extension
    const lastDotIndex = profileImageUrl.lastIndexOf('.');
    if (lastDotIndex === -1) return `${global.config.cdn_user_url}/${profileImageUrl}${suffix}`;
    
    const nameWithoutExt = profileImageUrl.substring(0, lastDotIndex);
    const extension = profileImageUrl.substring(lastDotIndex);
    return `${global.config.cdn_user_url}/${nameWithoutExt}${suffix}${extension}`;
  };

  const avatarContent = (
    <div
      className={`${sizeClasses[size]} rounded-full flex items-center justify-center font-semibold cursor-pointer transition-all duration-300 hover:ring-2 hover:ring-blue-500 hover:ring-offset-2 dark:hover:ring-offset-gray-900 ${className}`}
    >
      {profileImageUrl && !imageError ? (
        <img
          src={getImageUrl()}
          alt={username}
          className="w-full h-full rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
          {getInitial()}
        </div>
      )}
    </div>
  );

  if (linkToProfile) {
    return (
      <a href="/profile" className="block">
        {avatarContent}
      </a>
    );
  }

  return avatarContent;
}

export default ProfileAvatar;
