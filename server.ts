import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
let aiClient: GoogleGenAI | null = null;
if (apiKey) {
  aiClient = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// 1. Nearby Emergency Hospitals with Google Maps Grounding
app.post('/api/hospitals/nearby', async (req, res) => {
  try {
    const { latitude, longitude, city, state, preferredHospital } = req.body;
    const locationQuery = latitude && longitude
      ? `coordinates latitude ${latitude}, longitude ${longitude}`
      : (city ? `${city}, ${state || ''}` : 'nearby area');

    if (!aiClient) {
      // Fallback if no Gemini key configured
      return res.json({
        hospitals: [
          {
            name: preferredHospital || 'City General Emergency Hospital',
            address: `${city || 'Metro Area'} Emergency Care Wing`,
            phone: '108 / 911',
            type: 'Emergency & Trauma Care',
            mapsUrl: `https://www.google.com/maps/search/emergency+hospitals+near+${encodeURIComponent(city || 'me')}`,
          },
          {
            name: 'District Government Healthcare Center',
            address: `Main Hospital Road, ${city || 'City Center'}`,
            phone: '102 / Ambulance',
            type: '24/7 Government Emergency',
            mapsUrl: `https://www.google.com/maps/search/government+hospital+emergency+near+${encodeURIComponent(city || 'me')}`,
          }
        ],
        source: 'local_fallback',
      });
    }

    const prompt = `Find 3 to 4 real, currently operational emergency hospitals and 24/7 trauma centers closest to: ${locationQuery}.
${preferredHospital ? `Also include or check for the senior's preferred hospital: "${preferredHospital}".` : ''}
For each hospital, provide:
1. Hospital Name
2. Full physical address or landmark
3. Emergency phone number (or general emergency line)
4. Facility type (e.g., Level 1 Trauma, 24/7 ER, Multi-specialty ICU)
5. Direct Google Maps navigation URL or search query

Format the output strictly as a JSON array of objects with keys: name, address, phone, type, mapsUrl. Output valid JSON only, no markdown markers.`;

    try {
      const response = await aiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
          tools: [{ googleMaps: {} }],
        },
      });

      const rawText = response.text || '';
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      let hospitals = [];
      try {
        hospitals = JSON.parse(cleanJson);
      } catch {
        // Fallback parse or structured extraction
        hospitals = [
          {
            name: preferredHospital || 'Apex Emergency Care Center',
            address: `Near ${city || 'Current Location'}`,
            phone: '108 (Ambulance)',
            type: '24/7 Emergency Room',
            mapsUrl: `https://www.google.com/maps/search/emergency+hospital+${encodeURIComponent(city || '')}`,
          }
        ];
      }

      return res.json({ hospitals, source: 'maps_grounding' });
    } catch (modelError: any) {
      console.warn('Maps grounding model error, returning fallback:', modelError?.message);
      return res.json({
        hospitals: [
          {
            name: preferredHospital || 'City Emergency Trauma Center',
            address: `${city || 'Local area'} Central Hospital Zone`,
            phone: '108 / 112',
            type: 'Emergency & Casualty Services',
            mapsUrl: `https://www.google.com/maps/search/emergency+hospitals+${encodeURIComponent(city || '')}`,
          }
        ],
        source: 'fallback_error',
      });
    }
  } catch (error: any) {
    console.error('Hospital lookup error:', error);
    res.status(500).json({ error: error.message || 'Failed to search hospitals' });
  }
});

// 2. AI First-Aid & Triage Emergency Guidance
app.post('/api/ai/emergency-triage', async (req, res) => {
  try {
    const { seniorName, age, bloodGroup, medicalConditions, allergies, medications, emergencyInstructions, bystanderObservation } = req.body;

    if (!aiClient) {
      return res.json({
        guidance: {
          immediateActions: [
            'Keep the senior in a safe, comfortable, and shaded position.',
            'Check if breathing and responsive. Do NOT leave them unattended.',
            'Call the emergency contact or local ambulance (108/911/112).',
            `Verify blood group (${bloodGroup || 'Recorded in SafeScan'}) with emergency medical responders.`
          ],
          criticalWarnings: [
            allergies ? `DO NOT ADMINISTER: ${allergies}` : 'Do not give oral medication or fluids if unconscious.',
            'Do not move the senior if you suspect neck, spine, or head injury from a fall.'
          ],
          calmBystanderTip: 'Speak gently and reassuringly to reduce confusion and anxiety.'
        }
      });
    }

    const prompt = `You are an Emergency Medical Triage AI supporting a bystander who just scanned the SafeScan QR code of a senior citizen in distress.
Senior Details:
- Name: ${seniorName || 'Senior'}
- Age: ${age || 'Elderly'}
- Blood Group: ${bloodGroup || 'Not specified'}
- Medical Conditions: ${medicalConditions || 'None specified'}
- Known Allergies: ${allergies || 'None specified'}
- Current Medications: ${medications || 'None specified'}
- Caregiver Emergency Instructions: ${emergencyInstructions || 'Call family immediately'}
- Bystander Observation/Issue: ${bystanderObservation || 'Lost/confused or unconscious'}

Generate concise, medically safe, non-invasive first-responder guidance for the bystander while waiting for medical personnel.
Format the output strictly as JSON with keys:
- immediateActions (array of 3-4 string instructions)
- criticalWarnings (array of 2-3 string warnings, especially regarding ${allergies ? `allergies: ${allergies}` : 'allergies'} and safe positioning)
- calmBystanderTip (1 sentence on keeping the senior calm and oriented)

Output pure JSON only, no markdown.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const cleanJson = (response.text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
    let guidance = JSON.parse(cleanJson);
    res.json({ guidance });
  } catch (error: any) {
    console.error('Triage AI error:', error);
    res.json({
      guidance: {
        immediateActions: [
          'Stay with the senior and monitor consciousness.',
          'Call emergency services (108 / 911 / 112) immediately.',
          'Contact the listed primary emergency contact directly from this screen.'
        ],
        criticalWarnings: [
          'Do not feed or give water to an unconscious or choking person.',
          'Note down all known allergies for incoming ambulance medics.'
        ],
        calmBystanderTip: 'Maintain a steady, reassuring tone and state your name clearly.'
      }
    });
  }
});

// 3. AI Note Enhancer for Caregivers & Seniors
app.post('/api/ai/enhance-notes', async (req, res) => {
  try {
    const { medicalConditions, allergies, medications, customNotes } = req.body;
    if (!aiClient) {
      return res.json({
        enhancedInstructions: `Diagnosed with: ${medicalConditions || 'N/A'}. Known allergies: ${allergies || 'N/A'}. In an emergency, please notify family immediately and show medical card to EMTs.`
      });
    }

    const prompt = `You are a healthcare specialist helping a senior citizen and their caregiver prepare their emergency identification card.
Based on the following data:
- Medical conditions: ${medicalConditions}
- Allergies: ${allergies}
- Medications: ${medications}
- Raw notes: ${customNotes || ''}

Write a crisp, urgent, high-visibility Emergency Action Note (maximum 3 bullet sentences) that ambulance medics or police can read in 5 seconds to provide life-saving care. Return only the plain text instructions.`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    res.json({ enhancedInstructions: response.text?.trim() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Setup Vite middleware in dev or static files in production
const isProduction = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3000;

async function startServer() {
  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SafeScan full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
