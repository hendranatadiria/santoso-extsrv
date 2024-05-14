// main.ts

import express, { Request, Response } from "express";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import 'dotenv/config';

const redisPort = parseInt(process.env.REDIS_PORT);
const redisClient = new Redis( !isNaN(redisPort) ? redisPort : 6379, process.env.REDIS_HOST ?? '127.0.0.1');
const app = express();
const port = 9090;

app.use(express.json());

type ResponseData = {
  responseTime: string;
  success: boolean;
  result: any;
};

app.post("/addSession", async (req: Request, res: Response) => {
  try {
    const { data, pageName } = req.body;
    const uuid = uuidv4();
    const sessionId = uuid;
    const resData = {
      pageName: pageName,
      sessionId: sessionId,
    };
    await storeData(resData);
    const response: ResponseData = {
      success: true,
      responseTime: new Date().toISOString(),
      result: resData,
    };
    res.status(200).json(response);
  } catch (error) {
    console.error("Error storing data:", error);
    const response: ResponseData = {
      success: false,
      responseTime: new Date().toISOString(),
      result: error,
    };
    res.status(500).json(response);
  }
});

app.post("/get-data", async (req: Request, res: Response) => {
  try {
    const { sessionId, pageName } = req.body;
    const data = await getData(sessionId, pageName);
    if (data) {
      const response: ResponseData = {
        success: true,
        responseTime: new Date().toISOString(),
        result: data,
      };
      res.status(200).json(response);
    } else {
      const response: ResponseData = {
        success: false,
        responseTime: new Date().toISOString(),
        result: "Data not found.",
      };
      res.status(404).json(response);
    }
  } catch (error) {
    const response: ResponseData = {
      success: false,
      responseTime: new Date().toISOString(),
      result: error,
    };
    console.error("Error retrieving data:", error);
    res.status(500).json(response);
  }
});

app.post("/deleteSession", async (req: Request, res: Response) => {
  try {
    const { sessionId, pageName } = req.body;
    const data = await deleteData(sessionId, pageName);
    if (data) {
      const response: ResponseData = {
        success: true,
        responseTime: new Date().toISOString(),
        result: data,
      };
      res.status(200).json(response);
    } else {
      const response: ResponseData = {
        success: false,
        responseTime: new Date().toISOString(),
        result: "Data not found.",
      };
      res.status(404).json(response);
    }
  } catch (error) {
    console.error("Error retrieving data:", error);
    const response: ResponseData = {
      success: false,
      responseTime: new Date().toISOString(),
      result: error,
    };
    res.status(500).json(response);
  }
});

async function storeData(data: any) {
  const { sessionId, pageName } = data;

  // Check if the pageName already exists in the set
  const pageNameExists = await redisClient.sismember("pageNames", pageName);
  if (pageNameExists) {
    throw new Error("PageName already exists.");
  }

  const jsonData = JSON.stringify(data);

  // Add the pageName to the set
  await redisClient.sadd("pageNames", pageName);

  // Store the data in Redis
  await redisClient.set(`${sessionId}:${pageName}`, jsonData, "EX", 300); // Expires after 5 minutes
}

async function getData(
  sessionId: string,
  pageName: string
): Promise<any | null> {
  const jsonData = await redisClient.get(`${sessionId}:${pageName}`);
  if (jsonData) {
    return JSON.parse(jsonData);
  } else {
    return null;
  }
}

async function deleteData(
  sessionId: string,
  pageName: string
): Promise<boolean> {
  const key = `${sessionId}:${pageName}`;
  const result = await redisClient.del(key);
  return result === 1; // If the key was deleted, `del` returns 1, otherwise 0
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
