import express, { Request, Response } from "express";
import { getAllChains, getViemChain } from "../../common/squidDB.js";

// Create the router
const router = express.Router();

// Get all necessary chains
router.get("/chains", async (req: Request, res: Response) => {
  return res.json(getAllChains().map((v) => getViemChain(v)));
});

export default router;
