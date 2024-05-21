// main.ts

import express, { Request, Response } from "express";
import Redis from "ioredis";
import { v4 as uuidv4 } from "uuid";
import 'dotenv/config';

const redisPort = parseInt(process.env.REDIS_PORT ?? '6379');
const redisClient = new Redis( redisPort, process.env.REDIS_HOST ?? '127.0.0.1');
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
      result: { error: (error as unknown as any).message, stack: error },
    };
    res.status(500).json(response);
  }
});

app.post("/get-data", async (req: Request, res: Response) => {
  try {
    const { sessionId, pageName } = req.body;
    const data = await getData(pageName);
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
      result: { error: (error as unknown as any).message, stack: error },
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
      result: { error: (error as unknown as any).message, stack: error },
    };
    res.status(500).json(response);
  }
});

app.post('/obtainSession', async (req: Request, res: Response) => {
  try {
    const { sessionId, pageName } = req.body;
    let data = await getData(pageName);

    if (data) {
      if ( data["sessionId"] !== sessionId) {
        throw Error('Halaman ini sedang digunakan oleh user lain, silakan coba lagi dalam 5 menit.')
      }
    } else {
      data = await storeData(req.body);
    }
    let response: ResponseData  = {
      success: true,
      responseTime: new Date().toISOString(),
      result: data ?? req.body,
    };
    res.status(200).json(response); 
  } catch (error) {
    console.error("Error retrieving data:", error);
    const response: ResponseData = {
      success: false,
      responseTime: new Date().toISOString(),
      result: { error: (error as unknown as any).message, stack: error },
    };
    res.status(400).json(response);
  }
});


app.post('/releaseSession', async (req: Request, res: Response) => {
  try {
    const { sessionId, pageName } = req.body;
    const data = await deleteData(sessionId, pageName);
    if (!data) {
      console.log(`Can't release session ${sessionId} because it doesn't exist`);
      console.log("Still returning OK anyway, user doesn't need to know.");
    }
      const response: ResponseData = {
        success: true,
        responseTime: new Date().toISOString(),
        result: "OK",
      };
      res.status(200).json(response);
  } catch (error) {
    console.error("Error retrieving data:", error);
    const response: ResponseData = {
      success: false,
      responseTime: new Date().toISOString(),
      result: { error: (error as unknown as any).message, stack: error },
    };
    res.status(500).json(response);
  }
})

async function storeData(data: any) {
  const { sessionId, pageName } = data;

  // Check if the pageName already exists in the set
  // const pageNameExists = await redisClient.sismember("pageNames", pageName);
  const pageNameExists = await getData(pageName);
  if (pageNameExists && pageNameExists["sessionId"] !== sessionId) {
    throw new Error("Session already exists.");
  }
  // if (pageNameExists) {
  //   throw new Error("PageName already exists.");
  // }

  const jsonData = JSON.stringify(data);

  // Add the pageName to the set
  // await redisClient.sadd("pageNames", pageName);

  // Store the data in Redis
  await redisClient.set(pageName, jsonData, "EX", 300); // Expires after 5 minutes
  
  // return pageName; with its TTL get in seconds
  const expireAt = await redisClient.ttl(pageName);
  data["expireAt"] = expireAt;

  return data;
}

async function getData(
  pageName: string
): Promise<any | null> {
  const jsonData = await redisClient.get(pageName);
  if (jsonData) {
    const expireAt = await redisClient.ttl(pageName);
    const data = JSON.parse(jsonData);
    data["expireAt"] = expireAt;
    return data;
  } else {
    return null;
  }
}

async function deleteData(
  sessionId: string,
  pageName: string
): Promise<boolean> {
  const data = await getData(pageName);
  if (data == null) {
    return false
  } else {
    if (data.sessionId == sessionId) {
      const result = await redisClient.del(pageName);
      return result === 1; // If the key was deleted, `del` returns 1, otherwise 0
    }
    throw new Error("Sesi ini tidak terdaftar!");
  }
}

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
