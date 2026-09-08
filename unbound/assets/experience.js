(() => {
  const preview = document.querySelector('#journey-preview');
  if (!preview) return;
  const steps = {
    import: ['A file you already own.', 'Choose an MP3 in Files to add it to your Unbound library.'],
    transfer: ['Your audio, on its way.', 'With Unbound Pro, transfer the file from iPhone to your paired Apple Watch. Wait for the transfer to finish.'],
    listen: ['On your wrist. Ready offline.', 'Connect your headphones to Apple Watch and play the transferred file. Your iPhone can stay at home.'],
  };
  document.querySelectorAll('[data-step]').forEach(button => {
    button.addEventListener('click', () => {
      const step = button.dataset.step;
      document.querySelectorAll('[data-step]').forEach(item => item.setAttribute('aria-pressed', String(item === button)));
      preview.dataset.state = step;
      document.querySelector('#preview-title').textContent = steps[step][0];
      document.querySelector('#preview-description').textContent = steps[step][1];
    });
  });
})();
