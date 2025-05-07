*Work in progress*

# MCP Human-in-the-loop

This MCP (Model Context Protocol) server allows AI assistants to delegate tasks to humans via Amazon Mechanical Turk. It provides a bridge between AI systems and human workers, enabling hybrid intelligence workflows.

## Architecture

This system consists of two main components:

1. **MCP Server**: A server implementing the Model Context Protocol that integrates with MTurk
2. **Form Server**: A simple HTTP server that hosts the form for MTurk workers

The AI assistant connects to the MCP server, which creates tasks on MTurk. Human workers complete these tasks through a form hosted by the form server, and their responses are made available to the AI assistant.

## Setup

### Prerequisites

- Node.js 16+
- An AWS account with MTurk access
- AWS credentials with MTurk permissions

### Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Configure AWS credentials:
   ```
   export AWS_ACCESS_KEY_ID=your_access_key
   export AWS_SECRET_ACCESS_KEY=your_secret_key
   export AWS_REGION=us-east-1
   ```

3. Build the TypeScript code:
   ```
   npm run build
   ```

### Running

1. Start the form server (in one terminal):
   ```
   node form-server.js
   ```

2. Start the MCP server (in another terminal):
   ```
   npm run start
   ```

### Configuration

The server can be configured with the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `FORM_SERVER_URL` | URL to the form server | `http://localhost:3000` |
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

## Production Deployment

For production use:

1. Host the form server on a public-facing HTTPS service (e.g., AWS, Heroku, Vercel)
2. Update the `FORM_SERVER_URL` environment variable to point to your hosted form
3. Set `MTURK_SANDBOX=false` for real MTurk tasks (costs real money!)
4. Consider adding authentication to your form server
5. Use a proper XML parser for processing MTurk answers
6. Add more error handling and retries

## Limitations

- Currently only supports simple text-based questions and answers
- Limited to one assignment per HIT
- No support for custom HTML/JS in the form
- Simple polling for results rather than a webhook approach
- Uses MTurk's ExternalQuestion format, which requires hosting a form

## Future Enhancements

- Support for qualification requirements
- Support for multiple assignments per HIT
- Ability to specify worker selection criteria
- Custom form templates
- WebSocket-based notifications for real-time responses
- Integration with MTurk Review Policies
