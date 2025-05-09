# MCP-Human: Human Assistance for AI Assistants

A Model Context Protocol (MCP) server that enables AI assistants to get human input when needed. This tool creates tasks on Amazon Mechanical Turk that let real humans answer questions from AI systems. While primarily a proof-of-concept, it demonstrates how to build human-in-the-loop AI systems using the MCP standard. See [limitations](#limitations) for current constraints.

![we need to go deeper](./deeper.gif)

## Setup

### Prerequisites

- Node.js 16+
- AWS credentials with MTurk permissions. See [instructions below](#setting-up-aws-user-with-mechanical-turk-access).
- [AWS CLI](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (recommended for setting aws credentials)

### Configuring AWS credentials

```sh
# Configure AWS credentials for profile mcp-human
export AWS_ACCESS_KEY_ID="your_access_key"
export AWS_SECRET_ACCESS_KEY="your_secret_key"
aws configure set aws_access_key_id ${AWS_ACCESS_KEY_ID} --profile mcp-human
aws configure set aws_secret_access_key ${AWS_SECRET_ACCESS_KEY} --profile mcp-human
```

### Configuring MCP server with your MCP client

### Claude code

Sandbox mode:

```sh
claude mcp add human -- npx -y mcp-human@latest
```

The server defaults to [sandbox mode](https://workersandbox.mturk.com/) (for testing). If you want to submit real requests, use `MTURK_SANDBOX=false`.

```sh
claude mcp add human -e MTURK_SANDBOX=false -- npx -y mcp-human@latest
```

### Generic

Update the configuration of your MCP client to the following:

```json
{
  "mcpServers": {
    "human": {
      "command": "npx",
      "args": ["-y", "mcp-human@latest"]
    }
  }
}
```

e.g.: Claude Desktop (MacOS): `~/Library/Application\ Support/Claude/claude_desktop_config.json`

## Configuration

The server can be configured with the following environment variables:

| Variable         | Description                                        | Default                          |
| ---------------- | -------------------------------------------------- | -------------------------------- |
| `MTURK_SANDBOX`  | Use MTurk sandbox (`true`) or production (`false`) | `true`                           |
| `AWS_REGION`     | AWS region for MTurk                               | `us-east-1`                      |
| `AWS_PROFILE`    | AWS profile to use for credentials                 | `mcp-human`                      |
| `DEFAULT_REWARD` | The reward amount in USD.                          | `0.05`                           |
| `FORM_URL`       | URL where the form is hosted. Needs to be https.   | `https://syskall.com/mcp-human/` |

## Setting Up AWS User with Mechanical Turk Access

To create an AWS user with appropriate permissions for Mechanical Turk:

1. **Log in to the AWS Management Console**:

   - Go to https://aws.amazon.com/console/
   - Sign in as a root user or an administrator

2. **Create a new IAM User**:

   - Navigate to IAM (Identity and Access Management)
   - Click "Users" > "Create user"
   - Enter a username (e.g., `mturk-api-user`)
   - Click "Next" to proceed to permissions

3. **Set Permissions**:

   - Choose "Attach existing policies directly"
   - Search for and select `AmazonMechanicalTurkFullAccess`
   - If you need more granular control, you can create a custom policy with specific MTurk permissions
   - Click "Next" and then "Create user"

4. **Create Access Keys**:

   - After user creation, click on the username to go to their detail page
   - Go to the "Security credentials" tab
   - In the "Access keys" section, click "Create access key"
   - Choose "Application running outside AWS" or appropriate option
   - Click through the wizard and finally "Create access key"

5. **Save Credentials**:

   - Download the CSV file or copy the Access key ID and Secret access key
   - These will be used as `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables
   - **Important**: This is the only time you'll see the secret access key, so save it securely

6. **Configure MTurk Requester Settings**:
   - Visit the MTurk Requester website: https://requester.mturk.com/
   - Set up payment method and other account details
   - For testing, use the MTurk Sandbox: https://requestersandbox.mturk.com/

> **Note**: Always start with the MTurk Sandbox (`MTURK_SANDBOX=true`) to test your integration without spending real money. Only switch to production when you're confident in your implementation.

## Architecture

This system consists of two main components:

1. **MCP Server**: A server implementing the Model Context Protocol that integrates with MTurk
2. **Form**: A static HTML form.

The AI assistant connects to the MCP server, which creates tasks on MTurk. Human workers complete these tasks through a form, and their responses are made available to the AI assistant.

The Mechanical Turk form used is hosted on GitHub pages: [https://syskall.com/mcp-human/](https://syskall.com/mcp-human/). It gets populated with data through query parameters.

## MCP Tools

### askHuman

Allows an AI to ask a question to a human worker on Mechanical Turk.

Parameters:

- `question`: The question to ask a human worker
- `reward`: The reward amount in USD (default: $0.05)
- `title`: Title for the HIT (optional)
- `description`: Description for the HIT (optional)
- `hitValiditySeconds`: Time until the HIT expires in seconds (default: 1 hour)

Example usage:

```javascript
// From the AI assistant's perspective
const response = await call("askHuman", {
  question:
    "What's a creative name for a smart home device that adjusts lighting based on mood?",
  reward: "0.25",
  title: "Help with creative product naming",
  hitValiditySeconds: 3600, // HIT valid for 1 hour
});
```

If a worker responds within the HIT's validity period, the response will contain their answer. If not, it will return a HIT ID that can be checked later.

### checkHITStatus

Check the status of a previously created HIT and retrieve any submitted assignments.

Parameters:

- `hitId`: The HIT ID to check status for

Example usage:

```javascript
// From the AI assistant's perspective
const status = await call("checkHITStatus", {
  hitId: "3XMVN1BINNIXMTM9TTDO1GKMW7SGGZ",
});
```

## Resources

### mturk-account

Provides access to MTurk account information.

URIs:

- `mturk-account://balance` - Get account balance
- `mturk-account://hits` - List HITs
- `mturk-account://config` - Get configuration info

## Limitations

- Need to implement [progress notifications](https://github.com/modelcontextprotocol/typescript-sdk/issues/461) to avoid getting timing out.
- Currently only supports simple text-based questions and answers
- Limited to one assignment per HIT
- No support for custom HTML/JS in the form
- Simple polling for results rather than a webhook approach
- Uses MTurk's ExternalQuestion format, which requires hosting a form
