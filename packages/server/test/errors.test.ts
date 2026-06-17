import { describe, expect, it } from "bun:test"
import {
  ConflictError,
  ForbiddenError,
  InvalidCursorError,
  InvalidRequestError,
  PermissionNotFoundError,
  ProviderNotFoundError,
  PtyNotFoundError,
  QuestionNotFoundError,
  ServiceUnavailableError,
  SessionNotFoundError,
  UnauthorizedError,
  UnknownError,
} from "../src/errors"

describe("Server errors", () => {
  it("InvalidRequestError has correct _tag and fields", () => {
    const err = new InvalidRequestError({ message: "bad input" })
    expect(err._tag).toBe("InvalidRequestError")
    expect(err.message).toBe("bad input")
  })

  it("InvalidRequestError with optional fields", () => {
    const err = new InvalidRequestError({ message: "bad field", kind: "validation", field: "email" })
    expect(err.kind).toBe("validation")
    expect(err.field).toBe("email")
  })

  it("UnauthorizedError has correct _tag", () => {
    const err = new UnauthorizedError({ message: "unauthorized" })
    expect(err._tag).toBe("UnauthorizedError")
    expect(err.message).toBe("unauthorized")
  })

  it("ForbiddenError has correct _tag", () => {
    const err = new ForbiddenError({ message: "forbidden" })
    expect(err._tag).toBe("ForbiddenError")
  })

  it("NotFound errors have correct _tag and identifiers", () => {
    const provider = new ProviderNotFoundError({ providerID: "openai", message: "not found" })
    const session = new SessionNotFoundError({ sessionID: "abc", message: "not found" })
    const permission = new PermissionNotFoundError({ requestID: "req-1", message: "not found" })
    const question = new QuestionNotFoundError({ requestID: "req-1", message: "not found" })
    const pty = new PtyNotFoundError({ ptyID: "pty-1", message: "not found" })

    expect(provider._tag).toBe("ProviderNotFoundError")
    expect(provider.providerID).toBe("openai")
    expect(session._tag).toBe("SessionNotFoundError")
    expect(session.sessionID).toBe("abc")
    expect(permission._tag).toBe("PermissionNotFoundError")
    expect(permission.requestID).toBe("req-1")
    expect(question._tag).toBe("QuestionNotFoundError")
    expect(question.requestID).toBe("req-1")
    expect(pty._tag).toBe("PtyNotFoundError")
    expect(pty.ptyID).toBe("pty-1")
  })

  it("ConflictError has correct _tag and resource", () => {
    const err = new ConflictError({ message: "conflict", resource: "session" })
    expect(err._tag).toBe("ConflictError")
    expect(err.resource).toBe("session")
  })

  it("ServiceUnavailableError has correct _tag and service", () => {
    const err = new ServiceUnavailableError({ message: "down", service: "db" })
    expect(err._tag).toBe("ServiceUnavailableError")
    expect(err.service).toBe("db")
  })

  it("UnknownError has correct _tag and ref", () => {
    const err = new UnknownError({ message: "oops", ref: "err-123" })
    expect(err._tag).toBe("UnknownError")
    expect(err.ref).toBe("err-123")
  })

  it("InvalidCursorError has correct _tag", () => {
    const err = new InvalidCursorError({ message: "bad cursor" })
    expect(err._tag).toBe("InvalidCursorError")
  })
})
