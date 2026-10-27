import { useState } from 'react';

export default function SafeAvatar({ src, alt = '', initial = '?', imageStyle, fallbackStyle }) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <span aria-hidden="true" style={fallbackStyle}>{initial}</span>;
  }

  return <img src={src} alt={alt} style={imageStyle} onError={() => setFailed(true)} />;
}
