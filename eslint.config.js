/**
 * OtterClaw ESLint flat config.
 *
 * Single rule: ban direct `child_process` / `node:child_process` imports
 * in skill directories. All CLI invocation must go through `runtime.exec()`.
 */

const noDirectChildProcess = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow direct child_process imports — use runtime.exec() instead",
    },
    messages: {
      banned:
        "Do not import '{{module}}' directly. Use runtime.exec() for all CLI invocation.",
    },
    schema: [],
  },
  create(context) {
    const BANNED = new Set([
      "child_process",
      "node:child_process",
    ]);

    return {
      ImportDeclaration(node) {
        if (BANNED.has(node.source.value)) {
          context.report({
            node: node.source,
            messageId: "banned",
            data: { module: node.source.value },
          });
        }
      },

      CallExpression(node) {
        if (
          node.callee.name === "require" &&
          node.arguments.length === 1 &&
          node.arguments[0].type === "Literal" &&
          BANNED.has(node.arguments[0].value)
        ) {
          context.report({
            node: node.arguments[0],
            messageId: "banned",
            data: { module: node.arguments[0].value },
          });
        }
      },
    };
  },
};

export default [
  {
    files: ["skills/**/*.js", "skills/**/*.ts", "partner-skills/**/*.js", "partner-skills/**/*.ts"],
    plugins: {
      otterclaw: { rules: { "no-direct-child-process": noDirectChildProcess } },
    },
    rules: {
      "otterclaw/no-direct-child-process": "error",
    },
  },
];
