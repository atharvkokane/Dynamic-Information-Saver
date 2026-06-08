const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json());

const DATA_FILE = path.join(__dirname, "saved_data.json");

app.post("/save", (req, res) => {
  const payload = req.body;
  if (!payload) {
    return res.status(400).send("No data provided");
  }

  let existing = [];
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, "utf8") || "[]";
      existing = JSON.parse(raw);
    }
  } catch (err) {
    console.error("Failed reading existing data file", err);
  }

  const entry = { id: Date.now(), savedAt: new Date().toISOString(), payload };
  existing.push(entry);

  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(existing, null, 2), "utf8");
    return res.json({ success: true, id: entry.id });
  } catch (err) {
    console.error("Failed saving data file", err);
    return res.status(500).send("Failed to save data");
  }
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
