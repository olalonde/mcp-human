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

### Form Hosting Options

You have two options for hosting the MTurk form:

#### Option 1: Use GitHub Pages (Recommended)

1. Fork this repository to your GitHub account
2. Enable GitHub Pages in the repository settings
3. The form will be available at `https://yourusername.github.io/mcp-human/mturk-form.html`
4. Set the `GITHUB_PAGES_URL` environment variable to `https://yourusername.github.io/mcp-human`

#### Option 2: Run the local form server

1. Start the form server:
   ```
   node form-server.js
   ```
2. Note: For MTurk to access this, you'll need to make it publicly accessible (using ngrok, port forwarding, etc.)

### Running the MCP Server

Start the MCP server:
```
npm run start
```

### Configuration

The server can be configured with the following environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `GITHUB_PAGES_URL` | URL to the GitHub Pages site hosting the form | - |
| `FORM_SERVER_URL` | URL to the form server (if not using GitHub Pages) | `http://localhost:3000` |
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

## Production Deployment

For production use:

### GitHub Pages Setup (Recommended)

1. Fork this repository to your GitHub account
2. Go to your repository settings > Pages
3. Set the source to "main" branch and the folder to "/ (root)"
4. Wait for GitHub to publish your site (URL will be shown in settings)
5. Set the `GITHUB_PAGES_URL` environment variable to your GitHub Pages URL
6. Set `MTURK_SANDBOX=false` for real MTurk tasks (costs real money!)

### Alternative Deployment Options

1. Host the static form on any web hosting service (AWS S3, Netlify, Vercel, etc.)
2. Set `GITHUB_PAGES_URL` to your hosting URL
3. If you need server-side functionality (for receiving callbacks):
   - Deploy the form-server.js to a service like Heroku, Railway, or AWS EC2
   - Set `CALLBACK_URL` to point to your server's API endpoint
4. Set `MTURK_SANDBOX=false` for real MTurk tasks

### Additional Production Considerations

1. Use HTTPS for all URLs (required by MTurk)
2. Consider adding authentication to your callback endpoints
3. Use a proper XML parser for processing MTurk answers
4. Add more error handling and retries
5. Set up monitoring for your MCP server

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
