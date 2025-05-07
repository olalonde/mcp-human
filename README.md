# MCP Human-in-the-loop

This MCP (Model Context Protocol) server allows AI assistants to delegate tasks to humans via Amazon Mechanical Turk. It provides a bridge between AI systems and human workers, enabling hybrid intelligence workflows.

## Architecture

This system consists of two main components:

1. **MCP Server**: A server implementing the Model Context Protocol that integrates with MTurk
2. **Form Hosting**: A static HTML form that can be hosted anywhere, including GitHub Pages

The AI assistant connects to the MCP server, which creates tasks on MTurk. Human workers complete these tasks through a form, and their responses are made available to the AI assistant.

## Setup

### Prerequisites

- Node.js 16+
- An AWS account with MTurk access
- AWS credentials with MTurk permissions

### Installation

```
npm install mcp-human
```

Configure AWS credentials:

```
export AWS_ACCESS_KEY_ID=your_access_key
export AWS_SECRET_ACCESS_KEY=your_secret_key
export AWS_REGION=us-east-1
```

### Form

The Mechanical Turk form used is hosted on GitHub pages: [https://syskall.com/mcp-human/](https://syskall.com/mcp-human/). It gets populated with data through query parameters.

### Running the MCP Server

Start the MCP server:

```
npm run start
```

### Configuration

The server can be configured with the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `CALLBACK_URL` | Optional URL for form submissions to be sent to | - |
| `MTURK_SANDBOX` | Use MTurk sandbox (`true`) or production (`false`) | `true` |
| `AWS_REGION` | AWS region for MTurk | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | AWS access key ID | - |
| `AWS_SECRET_ACCESS_KEY` | AWS secret access key | - |

## MCP Tools

### askHuman

Allows an AI to ask a question to a human worker on Mechanical Turk.

Parameters:
- `question`: The question to ask a human worker
- `reward`: The reward amount in USD (default: $0.05)
- `title`: Title for the HIT (optional)
- `description`: Description for the HIT (optional)
- `timeoutSeconds`: Time until the HIT expires in seconds (default: 1 hour)
- `maxWaitSeconds`: Maximum time to wait for a response in seconds (default: 5 minutes)

Example usage:
```javascript
// From the AI assistant's perspective
const response = await call("askHuman", {
  question: "What's a creative name for a smart home device that adjusts lighting based on mood?",
  reward: "0.25",
  title: "Help with creative product naming",
  maxWaitSeconds: 600 // Wait up to 10 minutes
});
```

If a worker responds within the `maxWaitSeconds` window, the response will contain their answer. If not, it will return a HIT ID that can be checked later.

### checkHITStatus

Check the status of a previously created HIT and retrieve any submitted assignments.

Parameters:
- `hitId`: The HIT ID to check status for

Example usage:
```javascript
// From the AI assistant's perspective
const status = await call("checkHITStatus", {
  hitId: "3XMVN1BINNIXMTM9TTDO1GKMW7SGGZ"
});
```

## Resources

### mturk-account

Provides access to MTurk account information.

URIs:
- `mturk-account://balance` - Get account balance
- `mturk-account://hits` - List HITs
- `mturk-account://config` - Get configuration info

# Limitations

- Currently only supports simple text-based questions and answers
- Limited to one assignment per HIT
- No support for custom HTML/JS in the form
- Simple polling for results rather than a webhook approach
- Uses MTurk's ExternalQuestion format, which requires hosting a form

# Future Enhancements

- Support for qualification requirements
- Support for multiple assignments per HIT
- Ability to specify worker selection criteria
- Custom form templates
- WebSocket-based notifications for real-time responses
- Integration with MTurk Review Policies
