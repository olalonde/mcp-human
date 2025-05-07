import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In-memory storage for answers (in a production system, use a database)
const answers = new Map();

// Create HTTP server
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Serve the MTurk form
  if (url.pathname === "/mturk-form") {
    fs.readFile(path.join(__dirname, "mturk-form.html"), (err, data) => {
      if (err) {
        res.writeHead(500);
        res.end("Error loading form");
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(data);
    });
    return;
  }

  // Handle form submissions
  if (url.pathname === "/submit" && req.method === "POST") {
    let body = "";

    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", () => {
      try {
        // Parse form data
        const params = new URLSearchParams(body);
        const assignmentId = params.get("assignmentId");
        const answer = params.get("answer");

        if (!assignmentId || !answer) {
          res.writeHead(400);
          res.end("Missing required fields");
          return;
        }

        // Store the answer
        answers.set(assignmentId, answer);

        // Return success response
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
          <html>
            <body>
              <h1>Thank you!</h1>
              <p>Your response has been submitted successfully.</p>
              <script>
                // For MTurk iframe integration
                setTimeout(() => {
                  if (window.opener) window.close();
                }, 3000);
              </script>
            </body>
          </html>
        `);
      } catch (error) {
        console.error("Error processing submission:", error);
        res.writeHead(500);
        res.end("Error processing submission");
      }
    });

    return;
  }

  // API to get an answer by assignment ID
  if (url.pathname === "/api/answers" && req.method === "GET") {
    const assignmentId = url.searchParams.get("assignmentId");

    if (!assignmentId) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Missing assignmentId parameter" }));
      return;
    }

    if (!answers.has(assignmentId)) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Answer not found" }));
      return;
    }

    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        assignmentId,
        answer: answers.get(assignmentId),
        timestamp: new Date().toISOString(),
      }),
    );

    return;
  }

  // Default route
  res.writeHead(404);
  res.end("Not Found");
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Form server running at http://localhost:${PORT}`);
  console.log(`MTurk form available at http://localhost:${PORT}/mturk-form`);
});
