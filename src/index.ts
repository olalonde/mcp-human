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

// Configuration
const FORM_SERVER_URL = process.env.FORM_SERVER_URL || "https://syskall.com/mcp-human";
const USE_SANDBOX = process.env.MTURK_SANDBOX !== "false"; // Default to sandbox for safety

// Initialize MTurk client
const mturkClient = new MTurkClient({
  region: process.env.AWS_REGION || "us-east-1",
  // Use the sandbox endpoint unless explicitly configured not to
  endpoint: USE_SANDBOX
    ? "https://mturk-requester-sandbox.us-east-1.amazonaws.com"
    : undefined,
  // Use the mcp-human AWS profile
  credentials: {
    profile: "mcp-human"
  }
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
      .default("0.05")
      .describe("The reward amount in USD (default: $0.05)"),
    title: z.string().optional().describe("Title for the HIT (optional)"),
    description: z
      .string()
      .optional()
      .describe("Description for the HIT (optional)"),
    timeoutSeconds: z
      .number()
      .default(3600)
      .describe("Time until the HIT expires in seconds (default: 1 hour)"),
    maxWaitSeconds: z
      .number()
      .default(300)
      .describe(
        "Maximum time to wait for a response in seconds (default: 5 minutes)",
      ),
  },
  async ({
    question,
    reward,
    title,
    description,
    timeoutSeconds,
    maxWaitSeconds,
  }) => {
    try {
      // Create HIT parameters
      // For GitHub Pages, use the direct HTML page URL
      // Default to local server if GITHUB_PAGES_URL is not set
      let formUrl;

      // Always use the GitHub Pages URL
      formUrl = new URL("/index.html", FORM_SERVER_URL);

      // Add question and callback parameters
      formUrl.searchParams.append("question", encodeURIComponent(question));

      // If a callback URL is provided, add it to the form URL
      if (process.env.CALLBACK_URL) {
        formUrl.searchParams.append("callbackUrl", process.env.CALLBACK_URL);
      }

      const params = {
        Title: title || "Answer a question from an AI assistant",
        Description:
          description ||
          "Please provide your human perspective on this question",
        Question: `
          <ExternalQuestion xmlns="http://mechanicalturk.amazonaws.com/AWSMechanicalTurkDataSchemas/2006-07-14/ExternalQuestion.xsd">
            <ExternalURL>${formUrl.toString()}</ExternalURL>
            <FrameHeight>600</FrameHeight>
          </ExternalQuestion>
        `,
        Reward: reward,
        MaxAssignments: 1,
        AssignmentDurationInSeconds: timeoutSeconds,
        LifetimeInSeconds: timeoutSeconds,
        AutoApprovalDelayInSeconds: 86400, // Auto-approve after 24 hours
      };

      // Create the HIT
      const createResult = await mturkClient.send(new CreateHITCommand(params));
      const hitId = createResult.HIT?.HITId;

      if (!hitId) {
        throw new Error("Failed to create HIT");
      }

      // Poll for results
      let assignment = null;
      const startTime = Date.now();
      const maxWaitTime = maxWaitSeconds * 1000;
      const pollInterval = 5000; // Poll every 5 seconds

      while (Date.now() - startTime < maxWaitTime) {
        const listAssignmentsResponse = await mturkClient.send(
          new ListAssignmentsForHITCommand({
            HITId: hitId,
            AssignmentStatuses: ["Submitted", "Approved"],
          }),
        );

        if (
          listAssignmentsResponse.Assignments &&
          listAssignmentsResponse.Assignments.length > 0
        ) {
          assignment = listAssignmentsResponse.Assignments[0];
          break;
        }

        // Wait before polling again
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
      }

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
          const answerText = assignment.Answer.replace(
            /<\?xml.*?\?>/,
            "",
          ).replace(
            /<Answer>.*?<QuestionIdentifier>.*?<\/QuestionIdentifier>.*?<FreeText>(.*?)<\/FreeText>.*?<\/Answer>/s,
            "$1",
          );

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
              console.log(
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
  new ResourceTemplate("mturk-account://{info}", { list: undefined }),
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
- Form Server URL: ${FORM_SERVER_URL}
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

// Start receiving messages on stdin and sending messages on stdout
const transport = new StdioServerTransport();
server.connect(transport).catch((err) => {
  console.error("Error connecting server:", err);
  process.exit(1);
});

console.log("MCP Human-in-the-loop server started");
