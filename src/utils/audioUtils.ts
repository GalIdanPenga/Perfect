/**
 * Plays a pleasant completion sound notification using Web Audio API
 */
export const playCompletionSound = (): void => {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    const playTone = (frequency: number, startTime: number, duration: number): void => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);

      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
    };

    const now = audioContext.currentTime;
    const toneDuration = 0.15;

    playTone(880, now, toneDuration);          // A5
    playTone(880 * 1.19, now + 0.15, toneDuration);  // C6
    playTone(880 * 1.5, now + 0.3, toneDuration);    // E6
  } catch (error) {
    console.warn('Failed to play completion sound:', error);
  }
};
