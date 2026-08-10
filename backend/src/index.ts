import express, { response } from "express";
import { createClient } from "redis";
import cors from "cors";
import { db } from "./db";

const client = await createClient()
  .on("error", (err) => console.log("Redis Client Error", err))
  .connect();
const app = express();

app.use(cors());

app.use(express.json());

app.post("/submission", async (req, res) => {
  const userId = req.body.userId;
  const code = req.body.code;
  const language = req.body.language;

  const response = await db.submissions.create({
    data: {
      code,
      language,
      status: "PENDING",
    },
  });

  try {
    await client.lPush("problems", JSON.stringify({ submissionId: response.id, code, language }));
    return res.status(200).json({ message: "processing" });
  } catch (err) {
    return res
      .status(500)
      .json({ message: "Error adding submission to queue" });
  }
});

app.listen(3000, () => {
  console.log("Server is running on port 3000");
});
