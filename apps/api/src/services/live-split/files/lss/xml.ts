type XMLAttributes = Readonly<Record<string, string>>;

export type XMLElement = readonly [
  name: string,
  attributes: XMLAttributes,
  children: ReadonlyArray<XMLNode>,
];

type XMLNode = string | XMLElement;

export type CreateXMLElementOptions = {
  readonly attributes?: XMLAttributes;
  readonly children?: ReadonlyArray<XMLNode>;
  readonly name: string;
};

const SPACE = " ";
const INDENTATION = SPACE.repeat(2);

export function createXMLElement({
  attributes = {},
  children = [],
  name,
}: CreateXMLElementOptions): XMLElement {
  return [name, attributes, children];
}

function escapeXMLText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeXMLAttribute(value: string): string {
  return escapeXMLText(value)
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function renderAttributes(attributes: XMLAttributes): string {
  const rendered = Object.entries(attributes)
    .map(([name, value]) => {
      return `${name}="${escapeXMLAttribute(value)}"`;
    })
    .join(" ");

  return rendered.length === 0 ? "" : `${SPACE}${rendered}`;
}

function renderXMLNode(node: XMLNode, depth: number): ReadonlyArray<string> {
  const indentation = INDENTATION.repeat(depth);

  if (typeof node === "string") {
    return [`${indentation}${escapeXMLText(node)}`];
  }

  const [name, attributes, children] = node;
  const renderedAttributes = renderAttributes(attributes);

  if (children.length === 0) {
    return [`${indentation}<${name}${renderedAttributes} />`];
  }

  if (children.length === 1 && typeof children[0] === "string") {
    return [
      `${indentation}<${name}${renderedAttributes}>` +
        `${escapeXMLText(children[0])}` +
        `</${name}>`,
    ];
  }

  const childLines = children.flatMap((child) => {
    return renderXMLNode(child, depth + 1);
  });

  return [
    `${indentation}<${name}${renderedAttributes}>`,
    ...childLines,
    `${indentation}</${name}>`,
  ];
}

export function renderXMLDocument(root: XMLElement): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    ...renderXMLNode(root, 0),
  ];

  return `${lines.join("\n")}\n`;
}
