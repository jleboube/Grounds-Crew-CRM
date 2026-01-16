
import { GoogleGenAI, Type } from "@google/genai";
import { Customer, Recommendation, SunExposure } from "../types";
import { formatFullAddress } from "../utils/addressUtils";

// Initialize AI with the environment key
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export interface WeatherResponse {
  text: string;
  links: { title: string; uri: string }[];
}

export const gemini = {
  /**
   * Estimates sun exposure for a specific address using Google Search grounding.
   */
  async determineSunExposure(address: string): Promise<SunExposure> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze the property at "${address}". Determine the typical sun exposure for the lawn area. 
        Consider if it's a heavily wooded lot, a dense urban area with building shadows, or an open suburban lot.
        Return ONLY one of the following values: "Full Sun", "Partial Shade", or "Dense Shade".`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });
      
      const text = response.text?.trim() || "";
      if (text.includes("Full Sun")) return SunExposure.FULL_SUN;
      if (text.includes("Partial Shade")) return SunExposure.PARTIAL_SHADE;
      if (text.includes("Dense Shade")) return SunExposure.DENSE_SHADE;
      
      return SunExposure.FULL_SUN; // Default fallback
    } catch (e) {
      console.error("Sun detection error:", e);
      return SunExposure.FULL_SUN;
    }
  },

  /**
   * Get weather insights using Gemini Flash with Google Search grounding.
   * Extracts grounding metadata links as per requirements.
   */
  async getWeatherSummary(query: string): Promise<WeatherResponse> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Provide a structured weather-based lawn care report for today. 
        Focus on: Morning Dew/Frost, Precipitation Chances, and Optimal Mowing Windows.
        Use "###" for section headers. Context: ${query}`,
        config: {
          tools: [{ googleSearch: {} }]
        }
      });

      const links = response.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk: any) => ({
          title: chunk.web?.title || 'Source',
          uri: chunk.web?.uri || ''
        }))
        .filter((link: any) => link.uri !== '') || [];

      return {
        text: response.text || "Unable to retrieve weather insights at this time.",
        links: links
      };
    } catch (e) {
      console.error(e);
      return { text: "Weather service currently unavailable.", links: [] };
    }
  },

  /**
   * Predict optimal mowing times based on customer grass type, sun exposure, and last mow date.
   */
  async getMowingRecommendations(customers: Customer[]): Promise<Recommendation[]> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Analyze these customers and provide mowing schedule recommendations. Factor in grass types (Bermuda grows fast, Fescue prefers cooler), sun exposure (drying time), and last service date.
        
        Data: ${JSON.stringify(customers.map(c => ({
          id: c.id,
          name: c.name,
          grass: c.grassType,
          sun: c.sunExposure,
          lastMow: c.lastServiceDate
        })))}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                customerId: { type: Type.STRING },
                optimalTime: { type: Type.STRING, description: 'e.g. 10:00 AM - 1:00 PM' },
                reason: { type: Type.STRING, description: 'Why this time? (e.g. morning dew evaporation)' },
                score: { type: Type.NUMBER, description: 'Priority score 0-100' }
              },
              required: ['customerId', 'optimalTime', 'reason', 'score']
            }
          }
        }
      });

      return JSON.parse(response.text || '[]');
    } catch (e) {
      console.error(e);
      return [];
    }
  },

  /**
   * Advanced route optimization using Gemini 3 Pro with Thinking Budget
   */
  async getOptimizedRoute(customers: Customer[], date: string): Promise<string[]> {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Act as a spatial logistics expert. Create an optimal sequence for visiting these addresses on ${date}. 
        Optimize for:
        1. Minimal travel distance.
        2. Sequence based on property features: Sun-exposed properties should be mowed earlier as they dry faster.
        Address data includes sun exposure detected by AI.
        
        Addresses: ${JSON.stringify(customers.map(c => ({
          id: c.id,
          addr: formatFullAddress(c),
          city: c.city,
          state: c.state,
          sun: c.sunExposure
        })))}`,
        config: {
          thinkingConfig: { thinkingBudget: 32768 },
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              routeSequence: {
                type: Type.ARRAY,
                items: { type: Type.STRING, description: 'Customer ID' }
              },
              totalEstimatedMiles: { type: Type.NUMBER },
              reasoning: { type: Type.STRING }
            },
            required: ['routeSequence']
          }
        }
      });

      const data = JSON.parse(response.text || '{"routeSequence": []}');
      return data.routeSequence;
    } catch (e) {
      console.error(e);
      return customers.map(c => c.id);
    }
  }
};
