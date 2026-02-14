export const toDerivedMarkdown = (title: string, body: string): string => {
  const trimmedTitle = title.trim();
  if (trimmedTitle.length === 0) {
    return body;
  }
  if (body.trim().length === 0) {
    return `# ${trimmedTitle}`;
  }
  return `# ${trimmedTitle}\n\n${body}`;
};
