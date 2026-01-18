import { db } from "../db";
import { settings, type InsertSettings } from "../../shared/schema";
import { eq } from "drizzle-orm";

export class SettingsService {
  /**
   * Retrieves a setting value by key.
   * Priority: Database -> Environment Variable -> Default Value
   */
  async get(key: string, defaultValue: string = ""): Promise<string> {
    try {
      const [record] = await db
        .select()
        .from(settings)
        .where(eq(settings.key, key))
        .limit(1);

      if (record) {
        return record.value;
      }
    } catch (error) {
      console.warn(`SettingsService: Failed to fetch key '${key}' from DB. Falling back to env/default.`);
    }

    // Fallback to Env Var (Upper Snake Case)
    // e.g., "gemini_api_key" -> process.env.GEMINI_API_KEY
    const envKey = key.toUpperCase().replace(/-/g, "_");
    return process.env[envKey] || defaultValue;
  }

  /**
   * Sets a setting value in the database.
   */
  async set(key: string, value: string): Promise<void> {
    try {
      await db
        .insert(settings)
        .values({ key, value })
        .onConflictDoUpdate({
          target: settings.key,
          set: { value, updatedAt: new Date() },
        });
    } catch (error) {
      console.error(`SettingsService: Failed to save key '${key}'.`, error);
      throw error;
    }
  }

  /**
   * Getting specific API keys
   */
  async getGeminiKey(): Promise<string> {
    return this.get("gemini_api_key");
  }

  async getOpenAIKey(): Promise<string> {
    return this.get("openai_api_key");
  }
}

export const settingsService = new SettingsService();
