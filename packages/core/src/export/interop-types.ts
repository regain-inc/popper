/**
 * Interop Payload Reference Types
 *
 * Local types for TEFCA/USCDI interoperability metadata.
 * Per spec: §6 of hermes-contracts — these types will move to @regain/hermes
 * once the interop protocol is finalized.
 *
 * @module export/interop-types
 */

/** Supported interoperability standards */
export type InteropStandard = 'FHIR_R4' | 'HL7V2' | 'OTHER';

/**
 * Reference to an interoperable payload within an export bundle.
 * Provides traceability for TEFCA exchange purposes.
 */
export interface InteropPayloadRef {
  /** Unique interop reference ID */
  interop_id: string;
  /** Standard used for this payload */
  standard: InteropStandard;
  /** MIME content type */
  content_type: string;
  /** HL7/FHIR message type (e.g., 'ADT^A01', 'Bundle') */
  message_type?: string;
  /** URI pointing to the payload location */
  uri: string;
  /** SHA-256 hash of the payload content */
  content_hash?: string;
  /** Audit redaction summary (PHI-safe) */
  audit_redaction: { summary: string };
}
