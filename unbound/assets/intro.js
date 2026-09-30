(() => {
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  if (motion.matches || location.hash) return;
  try {
    if (sessionStorage.getItem('unbound-intro-seen')) return;
    sessionStorage.setItem('unbound-intro-seen', '1');
  } catch { /* Playback still works when storage is unavailable. */ }

  const overlay = document.createElement('div');
  overlay.className = 'site-intro';
  overlay.innerHTML = '<video muted playsinline preload="auto" aria-hidden="true"></video><img hidden aria-hidden="true" alt=""><button type="button">Skip intro</button>';
  const video = overlay.querySelector('video');
  const fallback = overlay.querySelector('img');
  const introBase = new URL(document.currentScript.src);
  video.muted = true;
  video.src = new URL('intro.mp4', introBase).href;
  document.body.append(overlay);
  document.documentElement.classList.add('intro-playing');
  // Use the visible screen, including changes to mobile browser toolbars.
  // Width comes only from the source ratio, never from the device width.
  const viewport = window.visualViewport;
  function sizeVideo() {
    const height = viewport ? viewport.height : window.innerHeight;
    overlay.style.top = `${viewport ? viewport.offsetTop : 0}px`;
    overlay.style.height = `${height}px`;
    overlay.style.bottom = 'auto';
    video.style.height = `${height}px`;
    if (video.videoHeight) {
      video.style.width = `${height * video.videoWidth / video.videoHeight}px`;
    }
  }
  function useGifFallback() {
    video.style.display = 'none';
    fallback.src = new URL('intro.gif', introBase).href;
    fallback.hidden = false;
    fallback.addEventListener('load', sizeVideo, { once: true });
    sizeVideo();
    setTimeout(finish, 5000);
  }
  sizeVideo();
  video.addEventListener('loadedmetadata', sizeVideo);
  window.addEventListener('resize', sizeVideo);
  viewport?.addEventListener('resize', sizeVideo);
  viewport?.addEventListener('scroll', sizeVideo);
  let finished = false;
  let loadingTimer;
  let safetyTimer;
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(loadingTimer);
    clearTimeout(safetyTimer);
    video.pause();
    video.removeEventListener('loadedmetadata', sizeVideo);
    window.removeEventListener('resize', sizeVideo);
    viewport?.removeEventListener('resize', sizeVideo);
    viewport?.removeEventListener('scroll', sizeVideo);
    overlay.classList.add('is-finished');
    document.documentElement.classList.remove('intro-playing');
    document.removeEventListener('keydown', onKey);
    motion.removeEventListener('change', finish);
    setTimeout(() => overlay.remove(), 1250);
  }
  function onKey(event) {
    if (event.key === 'Escape' || event.key === 'Tab') finish();
  }
  overlay.querySelector('button').addEventListener('click', finish);
  document.addEventListener('keydown', onKey);
  motion.addEventListener('change', finish);
  video.addEventListener('ended', finish);
  video.addEventListener('error', useGifFallback);
  video.addEventListener('playing', () => clearTimeout(loadingTimer), { once: true });
  loadingTimer = setTimeout(finish, 5000);
  safetyTimer = setTimeout(finish, 30000);
  video.play().catch(finish);
})();
