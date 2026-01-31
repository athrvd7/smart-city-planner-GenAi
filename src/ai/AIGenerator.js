/* ========================================
   Smart City Planner - Gemini AI Integration
   ======================================== */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { CITY_PRESETS, ZONE_TYPES } from '../utils/constants.js';
import { sleep } from '../utils/helpers.js';

export class AIGenerator {
    constructor(apiKey = null) {
        this.apiKey = apiKey;
        this.genAI = null;
        this.model = null;
        this.isGenerating = false;

        if (apiKey) {
            this.initializeAI(apiKey);
        }
    }

    /**
     * Initialize Gemini AI with API key
     * @param {string} key 
     */
    initializeAI(key) {
        try {
            this.apiKey = key;
            this.genAI = new GoogleGenerativeAI(key);
            this.model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
            return true;
        } catch (error) {
            console.error('Failed to initialize Gemini AI:', error);
            return false;
        }
    }

    /**
     * Set API key for Gemini
     * @param {string} key 
     */
    setApiKey(key) {
        return this.initializeAI(key);
    }

    /**
     * Check if AI is available
     */
    isAIAvailable() {
        return this.model !== null;
    }

    /**
     * Generate city layout using real Gemini API
     * @param {string} prompt 
     * @param {Object} params 
     * @returns {Promise<Object>}
     */
    async generate(prompt, params = {}) {
        this.isGenerating = true;

        try {
            // If API is available, use real AI generation
            if (this.isAIAvailable()) {
                return await this.generateWithGemini(prompt, params);
            } else {
                // Fall back to demo mode
                return await this.generateDemo(prompt, params);
            }
        } catch (error) {
            console.error('Generation error:', error);
            // Fall back to demo on error
            return await this.generateDemo(prompt, params);
        } finally {
            this.isGenerating = false;
        }
    }

    /**
     * Generate using real Gemini API
     * @param {string} prompt 
     * @param {Object} params 
     */
    async generateWithGemini(prompt, params) {
        const systemPrompt = `You are an urban planning AI assistant. Given a city description, you must respond with ONLY a valid JSON object (no markdown, no explanation) containing city layout parameters.

The JSON must have this exact structure:
{
  "residentialRatio": 0.35,
  "commercialRatio": 0.15,
  "industrialRatio": 0.1,
  "greenRatio": 0.25,
  "transitRatio": 0.1,
  "roadRatio": 0.05,
  "analysis": "Brief analysis of the city design",
  "suggestions": ["suggestion 1", "suggestion 2", "suggestion 3"],
  "cityType": "eco|tech|transit|mixed"
}

Rules:
- All ratios must be between 0 and 0.5
- Total of all ratios should be less than 1.0
- For eco/sustainable cities: high greenRatio (0.3-0.5), low industrialRatio
- For tech cities: high commercialRatio, moderate transitRatio
- For transit-first: high transitRatio (0.15-0.25), high residentialRatio
- Include practical, actionable suggestions`;

        const fullPrompt = `${systemPrompt}

User's city request: "${prompt}"
Target green space: ${Math.round((params.greenRatio || 0.25) * 100)}%

Respond with ONLY the JSON object:`;

        try {
            const result = await this.model.generateContent(fullPrompt);
            const response = await result.response;
            const text = response.text();

            // Parse JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const data = JSON.parse(jsonMatch[0]);

            return {
                success: true,
                params: {
                    residentialRatio: Math.min(0.5, Math.max(0, data.residentialRatio || 0.35)),
                    commercialRatio: Math.min(0.5, Math.max(0, data.commercialRatio || 0.15)),
                    industrialRatio: Math.min(0.3, Math.max(0, data.industrialRatio || 0.1)),
                    greenRatio: Math.min(0.5, Math.max(0, data.greenRatio || 0.25)),
                    transitRatio: Math.min(0.25, Math.max(0, data.transitRatio || 0.1)),
                    roadRatio: Math.min(0.15, Math.max(0.03, data.roadRatio || 0.05))
                },
                analysis: data.analysis || 'City layout generated based on your requirements.',
                suggestions: data.suggestions || [],
                cityType: data.cityType || 'mixed',
                source: 'gemini'
            };
        } catch (error) {
            console.error('Gemini API error:', error);
            throw error;
        }
    }

    /**
     * Demo mode generation (no API key)
     * @param {string} prompt 
     * @param {Object} params 
     */
    async generateDemo(prompt, params = {}) {
        // Simulate API delay
        await sleep(1500);

        // Analyze prompt to determine city type
        const cityType = this.analyzePrompt(prompt);

        // Get preset ratios
        const preset = CITY_PRESETS[cityType] || CITY_PRESETS.mixed;

        // Merge with custom params
        let layoutParams = {
            residentialRatio: preset.residentialRatio || 0.35,
            commercialRatio: preset.commercialRatio || 0.15,
            industrialRatio: preset.industrialRatio || 0.1,
            greenRatio: preset.greenRatio || 0.25,
            transitRatio: preset.transitRatio || 0.1,
            roadRatio: 0.05,
            ...params
        };

        // Adjust based on prompt keywords
        layoutParams = this.adjustFromPrompt(prompt, layoutParams);

        return {
            success: true,
            params: layoutParams,
            analysis: this.generateAnalysis(prompt, cityType, layoutParams),
            suggestions: this.generateSuggestions(cityType),
            cityType: cityType,
            source: 'demo'
        };
    }

    /**
     * Analyze prompt to determine city type
     * @param {string} prompt 
     * @returns {string}
     */
    analyzePrompt(prompt) {
        const lower = prompt.toLowerCase();

        if (lower.includes('eco') || lower.includes('sustainable') || lower.includes('green')) {
            return 'eco';
        }
        if (lower.includes('tech') || lower.includes('innovation') || lower.includes('smart')) {
            return 'tech';
        }
        if (lower.includes('transit') || lower.includes('metro') || lower.includes('public transport')) {
            return 'transit';
        }
        if (lower.includes('mixed') || lower.includes('balanced') || lower.includes('walkable')) {
            return 'mixed';
        }

        return 'mixed';
    }

    /**
     * Adjust layout params based on prompt keywords
     * @param {string} prompt 
     * @param {Object} params 
     * @returns {Object}
     */
    adjustFromPrompt(prompt, params) {
        const lower = prompt.toLowerCase();
        const adjusted = { ...params };

        // Green space adjustments
        if (lower.includes('park') || lower.includes('garden')) {
            adjusted.greenRatio = Math.min(0.5, adjusted.greenRatio + 0.1);
        }
        if (lower.includes('urban farm') || lower.includes('agriculture')) {
            adjusted.greenRatio = Math.min(0.5, adjusted.greenRatio + 0.15);
        }

        // Transit adjustments
        if (lower.includes('car-free') || lower.includes('pedestrian')) {
            adjusted.transitRatio = Math.min(0.25, adjusted.transitRatio + 0.1);
            adjusted.roadRatio = Math.max(0.02, adjusted.roadRatio - 0.02);
        }
        if (lower.includes('metro') || lower.includes('subway')) {
            adjusted.transitRatio = Math.min(0.25, adjusted.transitRatio + 0.05);
        }

        // Industrial adjustments
        if (lower.includes('clean') || lower.includes('no pollution')) {
            adjusted.industrialRatio = Math.max(0, adjusted.industrialRatio - 0.05);
            adjusted.greenRatio = Math.min(0.5, adjusted.greenRatio + 0.05);
        }
        if (lower.includes('manufacturing') || lower.includes('industry')) {
            adjusted.industrialRatio = Math.min(0.2, adjusted.industrialRatio + 0.05);
        }

        // Commercial adjustments
        if (lower.includes('business') || lower.includes('downtown')) {
            adjusted.commercialRatio = Math.min(0.3, adjusted.commercialRatio + 0.1);
        }

        // Population-based adjustments
        const popMatch = lower.match(/(\d+),?(\d*)\s*(million|k|thousand)?/);
        if (popMatch) {
            let pop = parseInt(popMatch[1] + (popMatch[2] || ''));
            if (popMatch[3] === 'million') pop *= 1000000;
            if (popMatch[3] === 'k' || popMatch[3] === 'thousand') pop *= 1000;

            if (pop > 1000000) {
                adjusted.residentialRatio = Math.min(0.45, adjusted.residentialRatio + 0.1);
                adjusted.transitRatio = Math.min(0.2, adjusted.transitRatio + 0.05);
            }
        }

        // Normalize ratios
        const total = adjusted.residentialRatio + adjusted.commercialRatio +
            adjusted.industrialRatio + adjusted.greenRatio +
            adjusted.transitRatio + adjusted.roadRatio;

        if (total > 0.95) {
            const factor = 0.95 / total;
            adjusted.residentialRatio *= factor;
            adjusted.commercialRatio *= factor;
            adjusted.industrialRatio *= factor;
            adjusted.greenRatio *= factor;
            adjusted.transitRatio *= factor;
            adjusted.roadRatio *= factor;
        }

        return adjusted;
    }

    /**
     * Generate analysis text
     */
    generateAnalysis(prompt, cityType, params) {
        const typeNames = {
            eco: 'Eco-Friendly City',
            tech: 'Smart Tech Hub',
            transit: 'Transit-Oriented City',
            mixed: 'Mixed-Use Urban Center'
        };

        const greenPct = Math.round(params.greenRatio * 100);
        const transitPct = Math.round(params.transitRatio * 100);
        const resPct = Math.round(params.residentialRatio * 100);

        return `Generated a ${typeNames[cityType]} with ${greenPct}% green spaces, ${transitPct}% transit infrastructure, and ${resPct}% residential areas. The layout optimizes for sustainability while meeting urban development needs.`;
    }

    /**
     * Generate suggestions
     */
    generateSuggestions(cityType) {
        const suggestions = {
            eco: [
                'Add solar panel installations to commercial districts',
                'Create wildlife corridors between green spaces',
                'Implement rainwater harvesting systems'
            ],
            tech: [
                'Deploy smart traffic management systems',
                'Install IoT sensors for city monitoring',
                'Create innovation zones near universities'
            ],
            transit: [
                'Add bike-sharing stations at transit hubs',
                'Create park-and-ride facilities at city edge',
                'Implement congestion pricing in the core'
            ],
            mixed: [
                'Develop neighborhood centers with local services',
                'Create connected pedestrian pathways',
                'Add community gardens in residential areas'
            ]
        };

        return suggestions[cityType] || suggestions.mixed;
    }

    /**
     * Generate from a preset
     */
    async generateFromPreset(presetId) {
        const preset = CITY_PRESETS[presetId];
        if (!preset) {
            return { success: false, error: 'Unknown preset' };
        }

        return this.generate(preset.prompt, preset);
    }
}
