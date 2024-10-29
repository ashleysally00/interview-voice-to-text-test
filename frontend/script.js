// Earlier code remains the same...

async function sendAudioToBackend() {
  try {
      statusElement.textContent = 'Processing audio...';
      
      const audioBlob = new Blob(audioChunks, { type: 'audio/wav' });
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.wav');

      const response = await fetch('/upload', {
          method: 'POST',
          body: formData
      });

      if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
          throw new Error(data.error);
      }

      displayResults(data);

  } catch (error) {
      console.error('Audio processing error:', error);
      statusElement.textContent = 'Error processing audio. Please try again.';
      transcriptElement.textContent = '';
  }
}

// Rest of the code remains the same...