
import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";

type Provider = "openai" | "groq";

type Message = {
  id: number;
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
};

type ChatResponse = {
  conversation_id: number;
  response: string;
  provider: Provider;
  model: string;
};

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function request<T>(
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as
      | { detail?: string }
      | null;

    throw new Error(
      body?.detail ?? `Request failed (${response.status})`
    );
  }

  return response.json() as Promise<T>;
}

const quickActions = [
  {
    icon: "✳",
    title: "Think with me",
    description: "Explore ideas and solve problems.",
    prompt: "Help me think through an idea.",
  },
  {
    icon: "⌘",
    title: "Get things done",
    description: "Plan tasks and organize your day.",
    prompt: "Help me organize my tasks for today.",
  },
  {
    icon: "◈",
    title: "Learn something",
    description: "Understand complex topics simply.",
    prompt: "Teach me something interesting today.",
  },
  {
    icon: "↗",
    title: "Build something",
    description: "Work through code and projects.",
    prompt: "Help me plan and build a software project.",
  },
];

function App() {
  const [provider, setProvider] = useState<Provider>("openai");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    request<Conversation[]>("/api/conversations")
      .then(setConversations)
      .catch((cause: Error) => setError(cause.message));
  }, []);

  useEffect(() => {
    if (activeId === null) {
      setMessages([]);
      return;
    }

    const controller = new AbortController();

    request<Message[]>(`/api/conversations/${activeId}/messages`, {
      signal: controller.signal,
    })
      .then(setMessages)
      .catch((cause: Error) => {
        if (cause.name !== "AbortError") {
          setError(cause.message);
        }
      });

    return () => controller.abort();
  }, [activeId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, loading]);

  async function refreshConversations() {
    const updated = await request<Conversation[]>("/api/conversations");
    setConversations(updated);
  }

  function startNewChat() {
    setActiveId(null);
    setMessages([]);
    setPrompt("");
    setError("");
    setSidebarOpen(false);
    textareaRef.current?.focus();
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = prompt.trim();

    if (!content || loading) return;

    const previousId = activeId;

    setLoading(true);
    setError("");
    setPrompt("");

    const optimisticMessage: Message = {
      id: Date.now(),
      role: "user",
      content,
    };

    setMessages((current) => [...current, optimisticMessage]);

    try {
      const result = await request<ChatResponse>("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          provider,
          message: content,
          conversation_id: previousId,
        }),
      });

      const assistantMessage: Message = {
        id: Date.now() + 1,
        role: "assistant",
        content: result.response,
      };

      setMessages((current) => [...current, assistantMessage]);

      if (previousId === null) {
        setActiveId(result.conversation_id);
      }

      await refreshConversations();
    } catch (cause) {
      setMessages((current) =>
        current.filter((message) => message.id !== optimisticMessage.id)
      );

      setPrompt(content);

      setError(
        cause instanceof Error
          ? cause.message
          : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function selectQuickAction(actionPrompt: string) {
    setPrompt(actionPrompt);
    textareaRef.current?.focus();
  }

  const hasMessages = messages.length > 0;

  return (
    <main className="raven-app">
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar ${sidebarOpen ? "sidebar-open" : ""}`}>
        <a
          href="/"
          className="brand"
          aria-label="Raven home"
          onClick={(event) => {
            event.preventDefault();
            startNewChat();
          }}
        >
          <span className="brand-symbol">R</span>
          <span className="brand-name">raven</span>
          <span className="brand-status" />
        </a>

        <button className="new-chat-button" onClick={startNewChat}>
          <span>＋</span>
          <span>New conversation</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="sidebar-section">
          <p className="sidebar-heading">WORKSPACE</p>

          <button className="nav-item nav-item-active">
            <span className="nav-icon">◈</span>
            <span>Assistant</span>
          </button>

          <button
            className="nav-item"
            title="Memory features are coming in a later phase"
          >
            <span className="nav-icon">⌁</span>
            <span>Memory</span>
            <span className="coming-soon">SOON</span>
          </button>

          <button
            className="nav-item"
            title="Integrations are coming in a later phase"
          >
            <span className="nav-icon">⤴</span>
            <span>Integrations</span>
            <span className="coming-soon">SOON</span>
          </button>
        </div>

        <div className="sidebar-section conversations-section">
          <div className="section-heading-row">
            <p className="sidebar-heading">RECENT</p>
            <span className="conversation-count">
              {conversations.length}
            </span>
          </div>

          <div className="conversation-list">
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                className={`conversation-item ${
                  activeId === conversation.id ? "conversation-active" : ""
                }`}
                onClick={() => {
                  setActiveId(conversation.id);
                  setError("");
                  setSidebarOpen(false);
                }}
              >
                <span className="conversation-dot">◦</span>
                <span className="conversation-name">
                  {conversation.title}
                </span>
              </button>
            ))}

            {conversations.length === 0 && (
              <p className="empty-conversations">
                Your conversations will appear here.
              </p>
            )}
          </div>
        </div>

        <div className="sidebar-bottom">
          <div className="profile-card">
            <div className="profile-avatar">D</div>
            <div className="profile-details">
              <span className="profile-name">Personal workspace</span>
              <span className="profile-subtitle">Raven · Private</span>
            </div>
            <span className="profile-menu">•••</span>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu-button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              ☰
            </button>

            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-separator">/</span>
              <strong>Assistant</strong>
            </div>
          </div>

          <div className="topbar-right">
            <div className="connection-status">
              <span className="status-dot" />
              <span>Workspace</span>
            </div>

            <label className="provider-select">
              <span className="provider-label">MODEL</span>
              <select
                value={provider}
                onChange={(event) =>
                  setProvider(event.target.value as Provider)
                }
                aria-label="AI provider"
              >
                <option value="openai">OpenAI</option>
                <option value="groq">Groq</option>
              </select>
            </label>
          </div>
        </header>

        <div className="dashboard-scroll">
          <div className="dashboard-content">
            {!hasMessages ? (
              <>
                <section className="welcome-section">
                  <div className="welcome-eyebrow">
                    <span className="eyebrow-line" />
                    YOUR PERSONAL AI
                    <span className="eyebrow-line" />
                  </div>

                  <div className="orb-stage">
                    <div className="orb-ring orb-ring-one" />
                    <div className="orb-ring orb-ring-two" />
                    <div className="orb-ring orb-ring-three" />

                    <div className="assistant-orb">
                      <div className="orb-inner">
                        <div className="orb-highlight" />
                        <div className="orb-core" />
                      </div>
                    </div>

                    <div className="orb-caption">
                      <span className="orb-caption-dot" />
                      RAVEN IS READY
                    </div>
                  </div>

                  <div className="welcome-copy">
                    <h1>
                      Your mind.
                      <br />
                      <span>Your momentum.</span>
                    </h1>

                    <p>
                      Think clearly, move faster and get things done.
                      <br className="desktop-break" />
                      Your assistant is right here.
                    </p>
                  </div>
                </section>

                <section className="quick-actions-section">
                  <div className="section-title-block">
                    <div>
                      <p className="content-eyebrow">GET STARTED</p>
                      <h2>What’s on your mind?</h2>
                    </div>
                    <span className="section-index">01 / 03</span>
                  </div>

                  <div className="quick-actions-grid">
                    {quickActions.map((action, index) => (
                      <button
                        className="action-card"
                        key={action.title}
                        onClick={() => selectQuickAction(action.prompt)}
                      >
                        <div className="action-card-top">
                          <span className="action-icon">{action.icon}</span>
                          <span className="action-arrow">↗</span>
                        </div>

                        <div>
                          <h3>{action.title}</h3>
                          <p>{action.description}</p>
                        </div>

                        <span className="action-number">
                          0{index + 1}
                        </span>
                      </button>
                    ))}
                  </div>
                </section>

                <section className="voice-preview-section">
                  <div className="voice-preview-icon">◖</div>
                  <div className="voice-preview-copy">
                    <span>COMING NEXT</span>
                    <h3>Talk to Raven, naturally.</h3>
                    <p>
                      Voice conversations and adaptive personality are
                      part of the next development phase.
                    </p>
                  </div>
                  <div className="voice-preview-badge">
                    VOICE ENGINE
                    <span>IN DEVELOPMENT</span>
                  </div>
                </section>
              </>
            ) : (
              <section className="chat-view">
                <div className="chat-heading">
                  <div className="chat-heading-icon">R</div>
                  <div>
                    <p className="content-eyebrow">RAVEN ASSISTANT</p>
                    <h1>Your conversation</h1>
                  </div>
                </div>

                <div className="message-list" aria-live="polite">
                  {messages.map((message) => (
                    <article
                      className={`message message-${message.role}`}
                      key={message.id}
                    >
                      <div className="message-avatar">
                        {message.role === "assistant" ? "R" : "D"}
                      </div>

                      <div className="message-body">
                        <p className="message-author">
                          {message.role === "assistant" ? "Raven" : "You"}
                        </p>
                        <p className="message-text">{message.content}</p>
                      </div>
                    </article>
                  ))}

                  {loading && (
                    <article className="message message-assistant">
                      <div className="message-avatar">R</div>
                      <div className="message-body">
                        <p className="message-author">Raven</p>
                        <div className="typing-indicator">
                          <span />
                          <span />
                          <span />
                        </div>
                      </div>
                    </article>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              </section>
            )}
          </div>
        </div>

        <footer className="composer-area">
          {error && (
            <div className="error-banner" role="alert">
              <span>!</span>
              {error}
            </div>
          )}

          <form className="composer" onSubmit={sendMessage}>
            <span className="composer-plus">＋</span>

            <textarea
              ref={textareaRef}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message Raven... Ask anything."
              aria-label="Message Raven"
              rows={1}
              maxLength={20000}
            />

            <div className="composer-actions">
              <span className="composer-hint">SHIFT + ENTER FOR NEW LINE</span>

              <button
                type="submit"
                className="send-button"
                disabled={loading || !prompt.trim()}
                aria-label="Send message"
              >
                ↑
              </button>
            </div>
          </form>

          <div className="composer-footer">
            <span>RAVEN AI</span>
            <span>Built for your momentum.</span>
          </div>
        </footer>
      </section>
    </main>
  );
}

export default App;
