import type { AlertType } from '../types'

/*
 * One short sentence per alert type, for the driver's full-screen alert and its voice.
 * The driver sees Tamil + English (plus Hindi when Hindi is chosen).
 *
 * TODO(human review): the Tamil and Hindi are machine translations. A native speaker
 * (ideally a truck driver) must check them: they will be read aloud on the highway.
 */
export const ALERT_SENTENCE: Record<'en' | 'ta' | 'hi', Record<AlertType, string>> = {
  en: {
    slow_leak: 'A tyre is slowly losing air. Stop at the nearest garage.',
    low_pressure: 'Tyre pressure is low. Fill air at the next stop.',
    critical_pressure: 'Tyre pressure is very low. Stop safely now.',
    high_temp: 'A tyre is very hot. Slow down and check the brakes.',
    sensor_offline: 'A tyre sensor is not sending data. Check it at the next stop.',
  },
  ta: {
    slow_leak: 'டயரில் காற்று மெதுவாக குறைகிறது. அருகிலுள்ள கேரேஜில் நிறுத்துங்கள்.',
    low_pressure: 'டயர் அழுத்தம் குறைவு. அடுத்த நிறுத்தத்தில் காற்று நிரப்புங்கள்.',
    critical_pressure: 'டயர் அழுத்தம் மிகவும் குறைவு. பாதுகாப்பாக உடனே நிறுத்துங்கள்.',
    high_temp: 'டயர் மிகவும் சூடாக உள்ளது. வேகத்தைக் குறைத்து பிரேக்கைச் சரிபாருங்கள்.',
    sensor_offline: 'டயர் சென்சார் தகவல் அனுப்பவில்லை. அடுத்த நிறுத்தத்தில் சரிபாருங்கள்.',
  },
  hi: {
    slow_leak: 'टायर से धीरे-धीरे हवा निकल रही है। पास के गैराज पर रुकें।',
    low_pressure: 'टायर का प्रेशर कम है। अगले स्टॉप पर हवा भरवाएँ।',
    critical_pressure: 'टायर का प्रेशर बहुत कम है। सुरक्षित जगह पर तुरंत रुकें।',
    high_temp: 'टायर बहुत गरम है। धीरे चलें और ब्रेक जाँचें।',
    sensor_offline: 'टायर सेंसर से डेटा नहीं आ रहा। अगले स्टॉप पर जाँचें।',
  },
}

export const SPEECH_LANG = { en: 'en-IN', ta: 'ta-IN', hi: 'hi-IN' } as const
