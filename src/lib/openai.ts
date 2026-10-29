import OpenAI from "openai";
import "dotenv/config";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

export const client = new OpenAI({
    apiKey: OPENAI_API_KEY
});
