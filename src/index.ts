#!/usr/bin/env node

import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  MTurkClient,
  CreateHITCommand,
  GetHITCommand,
  ListAssignmentsForHITCommand,
  GetAccountBalanceCommand,
  ListHITsCommand,
  ApproveAssignmentCommand,
} from "@aws-sdk/client-mturk";
import { XMLParser } from "fast-xml-parser";
const xmlParser = new XMLParser();

function escapeXml(unsafe: string) {
  return unsafe.replace(/[<>&'"]/g, (c: string): string => {
    switch (c) {
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "&":
        return "&amp;";
      case '"':
        return "&quot;";
      case "'":
        return "&apos;";
    }
    return c;
  });
}

// Open temporary file for logging
import { createWriteStream } from "fs";

const noop = (something: unknown) => {};
let log = noop;

// Logging for development....
if (process.env.MCP_HUMAN_LOGGING) {
  console.log("Logging to console");
  const logFile = createWriteStream("/tmp/mcp-human.log", { flags: "a" });
  log = (something: string | unknown) => {
    let message;
    if (typeof something === "string") {
      message = something;
    } else {
      message = JSON.stringify(something, null, 2);
    }
    const timestamp = new Date().toISOString();
    logFile.write(`[${timestamp}] ${message}\n`);
    console.error(`[${timestamp}] ${message}`);
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Load environment variables from .env file if it exists

// Configuration
const FORM_URL = process.env.FORM_URL || "https://syskall.com/mcp-human/";
const AWS_PROFILE = process.env.AWS_PROFILE || "mcp-human"; // Default to mcp-human profile
const USE_SANDBOX = process.env.MTURK_SANDBOX !== "false"; // Default to sandbox for safety
const DEFAULT_REWARD = process.env.DEFAULT_REWARD || "0.05"; // Default reward amount in USD
const turkSubmitTo = USE_SANDBOX
  ? "https://workersandbox.mturk.com/mturk/externalSubmit"
  : "https://www.mturk.com/mturk/externalSubmit";

// Initialize MTurk client
const mturkClient = new MTurkClient({
  region: process.env.AWS_REGION || "us-east-1",
  // Use the sandbox endpoint unless explicitly configured not to
  endpoint: USE_SANDBOX
    ? "https://mturk-requester-sandbox.us-east-1.amazonaws.com"
    : undefined,
  // Use the mcp-human AWS profile
  profile: AWS_PROFILE,
});

// Create an MCP server
const server = new McpServer({
  name: "Human-in-the-loop Assistant",
  version: "1.0.0",
});

// Add a tool to ask humans via MTurk
server.tool(
  "askHuman",
  {
    question: z.string().describe("The question to ask a human worker"),
    reward: z
      .string()
      .default(DEFAULT_REWARD)
      .describe("The reward amount in USD (default: $0.05)"),
    title: z.string().optional().describe("Title for the HIT (optional)"),
    description: z
      .string()
      .optional()
      .describe("Description for the HIT (optional)"),
    hitValiditySeconds: z
      .number()
      .default(3600)
      .describe("Time until the HIT expires in seconds (default: 1 hour)"),
  },
  async ({ question, reward, title, description, hitValiditySeconds }) => {
    try {
      // Create HIT parameters
      // For GitHub Pages, use the direct HTML page URL
      // Default to local server if GITHUB_PAGES_URL is not set
      let formUrl;

      // Always use the GitHub Pages URL
      formUrl = new URL(FORM_URL);

      // Add question and callback parameters
      formUrl.searchParams.append("question", question);

      // If a callback URL is provided, add it to the form URL
      if (process.env.CALLBACK_URL) {
        formUrl.searchParams.append("callbackUrl", process.env.CALLBACK_URL);
      }
      formUrl.searchParams.append("turkSubmitTo", turkSubmitTo);
      // assignmentId and hitId are added by the MTurk system

      log({ formUrl: formUrl.toString() });

      const params = {
        Title: title || "Answer a question from an AI assistant",
        Description:
          description ||
          "Please provide your human perspective on this question",
        Question: `
          <ExternalQuestion xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2006-07-14/ExternalQuestion.xsd">
            <ExternalURL>${escapeXml(formUrl.toString())}</ExternalURL>
            <FrameHeight>600</FrameHeight>
          </ExternalQuestion>
        `,
        Reward: reward,
        MaxAssignments: 1,
        AssignmentDurationInSeconds: hitValiditySeconds,
        LifetimeInSeconds: hitValiditySeconds,
        AutoApprovalDelayInSeconds: 86400, // Auto-approve after 24 hours
      };

      // Create the HIT
      const createResult = await mturkClient.send(new CreateHITCommand(params));
      const hitId = createResult.HIT?.HITId;

      log({ createResult });
      if (!hitId) {
        throw new Error("Failed to create HIT");
      }

      // Poll for results
      let assignment = null;
      const startTime = Date.now();
      const maxWaitTime = hitValiditySeconds * 1000;
      const pollInterval = 5000; // Poll every 5 seconds

      while (Date.now() - startTime < maxWaitTime) {
        log(`Fetching assignments for HIT ID: ${hitId}`);
        const listAssignmentsResponse = await mturkClient.send(
          new ListAssignmentsForHITCommand({
            HITId: hitId,
            AssignmentStatuses: ["Submitted", "Approved"],
          }),
        );
        log({ listAssignmentsResponse });

        if (
          listAssignmentsResponse.Assignments &&
          listAssignmentsResponse.Assignments.length > 0
        ) {
          assignment = listAssignmentsResponse.Assignments[0];
          break;
        }

        // Wait before polling again
        log(
          `We have been waiting ${Date.now() - startTime}ms, maxWaitTime is ${maxWaitTime}ms`,
        );
        log(`Waiting ${pollInterval}ms to poll again...`);
        await sleep(pollInterval);
        log(`Going back to beginning of loop`);
      }

      log({ assignment });

      // Return results
      if (assignment && assignment.AssignmentId) {
        // Auto-approve the assignment
        try {
          await mturkClient.send(
            new ApproveAssignmentCommand({
              AssignmentId: assignment.AssignmentId,
              RequesterFeedback: "Thank you for your response!",
            }),
          );
        } catch (approveError) {
          console.error("Error approving assignment:", approveError);
          // Continue with the response even if approval fails
        }

        if (assignment.Answer) {
          // Parse XML answer (simplified - in production, use an XML parser)
          const parsed = xmlParser.parse(assignment.Answer);
          const answerText = parsed.QuestionFormAnswers.Answer.FreeText;

          return {
            content: [
              {
                type: "text",
                text: `Human response: ${answerText}`,
              },
            ],
          };
        } else {
          return {
            content: [
              {
                type: "text",
                text: `Assignment received but answer format was invalid. Assignment ID: ${assignment.AssignmentId}, HIT ID: ${hitId}`,
              },
            ],
          };
        }
      } else {
        return {
          content: [
            {
              type: "text",
              text: `No response received within the maximum wait time. Your question is still available for workers on MTurk. HIT ID: ${hitId} - You can check its status later with the checkHITStatus tool.`,
            },
          ],
        };
      }
    } catch (error) {
      console.error("Error in askHuman tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

// Add a tool to check HIT status
server.tool(
  "checkHITStatus",
  {
    hitId: z.string().describe("The HIT ID to check status for"),
  },
  async ({ hitId }) => {
    try {
      const hitResponse = await mturkClient.send(
        new GetHITCommand({ HITId: hitId }),
      );
      const hit = hitResponse.HIT;

      if (!hit) {
        throw new Error(`HIT with ID ${hitId} not found`);
      }

      const assignmentsResponse = await mturkClient.send(
        new ListAssignmentsForHITCommand({
          HITId: hitId,
          AssignmentStatuses: ["Submitted", "Approved", "Rejected"],
        }),
      );

      // Auto-approve any submitted assignments
      if (assignmentsResponse.Assignments) {
        for (const assignment of assignmentsResponse.Assignments) {
          if (
            assignment.AssignmentStatus === "Submitted" &&
            assignment.AssignmentId
          ) {
            try {
              await mturkClient.send(
                new ApproveAssignmentCommand({
                  AssignmentId: assignment.AssignmentId,
                  RequesterFeedback: "Thank you for your response!",
                }),
              );
              console.error(
                `Auto-approved assignment ${assignment.AssignmentId}`,
              );
            } catch (approveError) {
              console.error(
                `Error auto-approving assignment ${assignment.AssignmentId}:`,
                approveError,
              );
            }
          }
        }
      }

      // Prepare a human-readable response with assignment answers
      const assignments = assignmentsResponse.Assignments || [];
      const assignmentDetails = assignments.map((a) => {
        let answer = "No answer content";
        if (a.Answer) {
          // Simple XML parsing (use a proper XML parser in production)
          answer = a.Answer.replace(/<\?xml.*?\?>/, "").replace(
            /<Answer>.*?<QuestionIdentifier>.*?<\/QuestionIdentifier>.*?<FreeText>(.*?)<\/FreeText>.*?<\/Answer>/s,
            "$1",
          );
        }

        return {
          id: a.AssignmentId,
          status: a.AssignmentStatus,
          submitTime: a.SubmitTime,
          answer,
        };
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                hitId: hit.HITId,
                title: hit.Title,
                status: hit.HITStatus,
                creationTime: hit.CreationTime,
                expiration: hit.Expiration,
                assignmentsCount: assignments.length,
                assignments: assignmentDetails,
                sandbox: USE_SANDBOX,
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      console.error("Error in checkHITStatus tool:", error);
      return {
        content: [
          {
            type: "text",
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

// Add a resource for MTurk account info
server.resource(
  "mturk-account",
  new ResourceTemplate("mturk-account://{info}", {
    list: async () => {
      return {
        resources: [
          {
            name: "balance",
            uri: "mturk-account://balance",
            description: "Get MTurk account balance",
          },
          {
            name: "hits",
            uri: "mturk-account://hits",
            description: "List active HITs",
          },
          {
            name: "config",
            uri: "mturk-account://config",
            description: "Get MTurk configuration",
          },
        ],
      };
    },
  }),
  async (uri, { info }) => {
    try {
      let content = "";

      // Return appropriate MTurk account information based on the requested info type
      switch (info) {
        case "balance":
          const balanceResponse = await mturkClient.send(
            new GetAccountBalanceCommand({}),
          );
          content = `Account Balance: ${balanceResponse.AvailableBalance || "unknown"}`;
          if (USE_SANDBOX) {
            content += "\n(Note: Using MTurk Sandbox environment)";
          }
          break;

        case "hits":
          const hitsResponse = await mturkClient.send(
            new ListHITsCommand({
              MaxResults: 100, // Limit to 100 most recent HITs
            }),
          );

          const hitsList =
            hitsResponse.HITs?.map((hit) => ({
              id: hit.HITId,
              title: hit.Title,
              status: hit.HITStatus,
              created: hit.CreationTime,
              expires: hit.Expiration,
              reward: hit.Reward,
            })) || [];

          content = `Active HITs: ${hitsList.length}\n\n${JSON.stringify(hitsList, null, 2)}`;
          if (USE_SANDBOX) {
            content += "\n(Note: Using MTurk Sandbox environment)";
          }
          break;

        case "config":
          content = `MTurk Configuration:
- Using Sandbox: ${USE_SANDBOX}
- Form Server URL: ${FORM_URL}
- Region: ${process.env.AWS_REGION || "us-east-1"}`;
          break;

        default:
          content = "Unknown info type. Try 'balance', 'hits', or 'config'.";
      }

      return {
        contents: [
          {
            uri: uri.href,
            text: content,
          },
        ],
      };
    } catch (error) {
      console.error("Error in mturk-account resource:", error);
      return {
        contents: [
          {
            uri: uri.href,
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  },
);

// Add a prompt for asking humans
server.prompt(
  "ask-human",
  "A prompt for asking human workers questions via MTurk",
  {
    question: z.string(),
    reward: z.string().optional(),
    title: z.string().optional(),
    maxWaitTime: z.string().optional(),
  },
  (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `I need to ask a human worker the following question: "${args.question}"`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I'll help you ask a human worker through Mechanical Turk. Let me set that up for you.`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `Let me ask a human for you: "${args.question}"`,
        },
      },
    ],
  }),
);

// Add another prompt for checking HIT status
server.prompt(
  "check-hit",
  "A prompt for checking the status of a HIT",
  {
    hitId: z.string(),
  },
  (args) => ({
    messages: [
      {
        role: "user",
        content: {
          type: "text",
          text: `Check the status of HIT with ID ${args.hitId}`,
        },
      },
      {
        role: "assistant",
        content: {
          type: "text",
          text: `I'll check the status of the HIT with ID ${args.hitId} for you.`,
        },
      },
    ],
  }),
);

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error("Error connecting server:", err);
  process.exit(1);
});

// console.log("MCP Human-in-the-loop server started");
