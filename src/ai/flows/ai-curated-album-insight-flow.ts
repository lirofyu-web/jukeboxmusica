'use server';
/**
 * @fileOverview A Genkit flow for generating AI-curated insights (synopsis or curious fact) about music albums or artists.
 *
 * - curateAlbumInsight - A function that generates an insight for a given album and artist.
 * - AICuratedAlbumInsightInput - The input type for the curateAlbumInsight function.
 * - AICuratedAlbumInsightOutput - The return type for the curateAlbumInsight function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AICuratedAlbumInsightInputSchema = z.object({
  albumTitle: z.string().describe('The title of the music album.'),
  artistName: z.string().describe('The name of the artist of the album.'),
});
export type AICuratedAlbumInsightInput = z.infer<typeof AICuratedAlbumInsightInputSchema>;

const AICuratedAlbumInsightOutputSchema = z.object({
  insight: z.string().describe('A brief, engaging synopsis or curious fact about the album or artist.'),
});
export type AICuratedAlbumInsightOutput = z.infer<typeof AICuratedAlbumInsightOutputSchema>;

export async function curateAlbumInsight(input: AICuratedAlbumInsightInput): Promise<AICuratedAlbumInsightOutput> {
  return aiCuratedAlbumInsightFlow(input);
}

const prompt = ai.definePrompt({
  name: 'curateAlbumInsightPrompt',
  input: {schema: AICuratedAlbumInsightInputSchema},
  output: {schema: AICuratedAlbumInsightOutputSchema},
  prompt: `You are an expert music curator and historian. Your task is to provide a brief, engaging synopsis or a curious, little-known fact about a given music album or artist. Focus on something that would deepen a listener's appreciation or understanding.\n\nAlbum Title: {{{albumTitle}}}\nArtist Name: {{{artistName}}}\n\nProvide a single, concise insight.`,
});

const aiCuratedAlbumInsightFlow = ai.defineFlow(
  {
    name: 'aiCuratedAlbumInsightFlow',
    inputSchema: AICuratedAlbumInsightInputSchema,
    outputSchema: AICuratedAlbumInsightOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
