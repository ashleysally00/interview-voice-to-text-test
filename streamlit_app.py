import streamlit as st
import sounddevice as sd
import numpy as np
from scipy.io.wavfile import write
from google.cloud import speech
from google.cloud import storage
from google.cloud import language_v1 as language
import tempfile
import os

# Set Google Cloud credentials
os.environ["GOOGLE_APPLICATION_CREDENTIALS"] = (
    "/Users/ashleyrice/Desktop/Projects/she-builds-ai/voice/backend/credentials.json"
)

# Initialize Google Cloud clients
speech_client = speech.SpeechClient()
storage_client = storage.Client()
language_client = language.LanguageServiceClient()

# Title of the app
st.title("Speech-to-Text with Sentiment Analysis")

def transcribe_from_gcs(gcs_uri):
    """Transcribe an audio file from GCS and perform sentiment analysis."""
    st.write(f"Transcribing audio from: {gcs_uri}")

    audio = speech.RecognitionAudio(uri=gcs_uri)
    config = speech.RecognitionConfig(
        encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
        language_code="en-US",
        use_enhanced=True,
    )

    try:
        response = speech_client.recognize(config=config, audio=audio)

        if response.results:
            st.subheader("Transcription")
            full_transcript = " ".join(
                [result.alternatives[0].transcript for result in response.results]
            )
            st.write(full_transcript)

            # Perform sentiment analysis on the transcript
            perform_sentiment_analysis(full_transcript)
        else:
            st.warning("No speech detected in the audio.")
    except Exception as e:
        st.error(f"An error occurred: {e}")

def perform_sentiment_analysis(text):
    """Perform sentiment analysis on the given text."""
    document = language.Document(content=text, type_=language.Document.Type.PLAIN_TEXT)

    try:
        sentiment = language_client.analyze_sentiment(request={"document": document}).document_sentiment

        st.subheader("Sentiment Analysis")
        st.write(f"Score: {sentiment.score}")
        st.write(f"Magnitude: {sentiment.magnitude}")

        # Interpretation of sentiment score
        if sentiment.score > 0:
            st.success("Positive Sentiment 🎉")
        elif sentiment.score < 0:
            st.error("Negative Sentiment 😔")
        else:
            st.info("Neutral Sentiment 😐")

    except Exception as e:
        st.error(f"Sentiment analysis error: {e}")

def list_files_in_bucket(bucket_name):
    """List all WAV files available in the specified GCS bucket."""
    st.write(f"Fetching files from bucket: {bucket_name}")
    blobs = storage_client.list_blobs(bucket_name)

    audio_files = [blob.name for blob in blobs if blob.name.endswith(".wav")]
    if not audio_files:
        st.warning("No WAV files found in the bucket.")
    return audio_files

# Input for the bucket name
bucket_name = st.text_input("Enter your GCS bucket name:")

# Test GCS Connection button
if bucket_name:
    audio_files = list_files_in_bucket(bucket_name)

    # Dropdown to select a WAV file from the bucket
    selected_file = st.selectbox("Select a WAV file to transcribe:", audio_files)

    if st.button("Transcribe and Analyze Sentiment"):
        gcs_uri = f"gs://{bucket_name}/{selected_file}"
        transcribe_from_gcs(gcs_uri)
