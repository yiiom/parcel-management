"use client";

import {
  useCallback,
  useRef,
  useState,
  type RefObject,
  type SubmitEvent,
} from "react";
import type { Occupancy } from "@/api/occupancies";
import {
  createParcel,
  getSourceOccupancy,
  updateParcel,
  toParcelError,
  ParcelApiError,
  type Parcel,
  type ParcelInput,
  type ParcelUpdate,
} from "@/api/parcels";
import { Modal } from "@/components/ui/common";
import { Query, RequestError } from "@/components/invitations/shared";
import ParcelOccupancyPicker, {
  ParcelRegistrationPicker,
  type ParcelTarget,
} from "./occupancy-picker";
import { ParcelSummary } from "./view";

type Draft = {
  recipient_name: string;
  courier: string;
  tracking_number: string;
  storage_location: string;
  note: string;
};

export default function ParcelEditor({
  buildingId,
  original,
  onClose,
  onSaved,
}: {
  buildingId: number;
  original: Parcel | null;
  onClose: () => void;
  onSaved: (parcel: Parcel) => void;
}) {
  const lockRef = useRef(false);

  const load = useCallback(async () => ({
    source: original ? await getSourceOccupancy(original) : null,
  }), [original]);

  return (
    <Modal
      title={original ? "更正包裹資料" : "登記包裹"}
      onClose={() => {
        // 送出期間保留表單，避免結果回來前誤以為操作已取消。
        if (!lockRef.current) onClose();
      }}
    >
      <Query load={load}>
        {({ source }) => (
          <ParcelForm
            buildingId={buildingId}
            original={original}
            source={source}
            lockRef={lockRef}
            onClose={onClose}
            onSaved={onSaved}
          />
        )}
      </Query>
    </Modal>
  );
}

function ParcelForm({
  buildingId,
  original,
  source,
  lockRef,
  onClose,
  onSaved,
}: {
  buildingId: number;
  original: Parcel | null;
  source: Occupancy | null;
  lockRef: RefObject<boolean>;
  onClose: () => void;
  onSaved: (parcel: Parcel) => void;
}) {
  const [draft, setDraft] = useState<Draft>({
    recipient_name: original?.recipient_name ?? "",
    courier: original?.courier ?? "",
    tracking_number: original?.tracking_number ?? "",
    storage_location: original?.storage_location ?? "",
    note: original?.note ?? "",
  });

  const [target, setTarget] = useState<ParcelTarget | null>(
    original && source
      ? { occupancy: source, unitLabel: original.unit_label }
      : null,
  );

  const [choosing, setChoosing] = useState(!original);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ParcelApiError | null>(null);

  const [warning, setWarning] = useState<{
    input: ParcelInput;
    records: Parcel[];
  } | null>(null);
  const [duplicateChecked, setDuplicateChecked] = useState(false);

  const [uncertain, setUncertain] = useState(false);
  const [reviewed, setReviewed] = useState(false);

  const sourceEnded = source?.ended_at !== null && source !== null;

  function field(name: keyof Draft, value: string) {
    setDraft((previous) => ({ ...previous, [name]: value }));
    setError(null);
  }

  function makeInput(): ParcelInput {
    if (!target) {
      throw new ParcelApiError(
        422,
        "TARGET_REQUIRED",
        "請選擇有效入住。",
      );
    }

    const recipient = draft.recipient_name.trim();

    if (!recipient || Array.from(recipient).length > 100) {
      throw new ParcelApiError(
        422,
        "RECIPIENT_FORMAT",
        "收件人姓名須為 1～100 個字元。",
      );
    }

    for (const key of [
      "courier",
      "tracking_number",
      "storage_location",
    ] as const) {
      if (Array.from(draft[key].trim()).length > 100) {
        throw new ParcelApiError(
          422,
          "TEXT_TOO_LONG",
          "物流公司、單號及存放位置各限 100 個字元。",
        );
      }
    }

    const optional = (value: string) => value.trim() || null;

    return {
      occupancy_id: target.occupancy.id,
      recipient_name: recipient,
      courier: optional(draft.courier),
      tracking_number: optional(draft.tracking_number),
      storage_location: optional(draft.storage_location),
      // 備註保留使用者輸入的空白與換行；清空時傳 null。
      note: draft.note === "" ? null : draft.note,
    };
  }

  function changedFields(input: ParcelInput): ParcelUpdate {
    if (!original) return input;

    const changes: ParcelUpdate = {};

    if (input.occupancy_id !== original.occupancy_id) {
      changes.occupancy_id = input.occupancy_id;
    }
    if (input.recipient_name !== original.recipient_name) {
      changes.recipient_name = input.recipient_name;
    }

    for (const key of [
      "courier",
      "tracking_number",
      "storage_location",
      "note",
    ] as const) {
      // 避免僅因 null／空字串的表示方式不同而觸發更正與取消驗證。
      if ((input[key] ?? "") !== (original[key] ?? "")) {
        changes[key] = input[key];
      }
    }

    return changes;
  }

  async function save(
    confirmed = false,
    confirmedInput?: ParcelInput,
  ) {
    if (lockRef.current || (uncertain && !reviewed)) return;

    lockRef.current = true;
    setBusy(true);
    setError(null);

    try {
      // 重複確認使用收到警告時的同一份內容，不能偷偷更換欄位。
      const input = confirmedInput ?? makeInput();

      const result = original
        ? await updateParcel(original.id, changedFields(input))
        : await createParcel(input, confirmed);

      onSaved(result);
    } catch (cause) {
      const failure = toParcelError(cause);

      if (
        !original &&
        failure.status === 409 &&
        failure.code === "DUPLICATE_PARCEL_CONFIRMATION_REQUIRED" &&
        failure.existingParcels.length > 0
      ) {
        setWarning({
          input: confirmedInput ?? makeInput(),
          records: failure.existingParcels,
        });
        setDuplicateChecked(false);
      } else {
        setError(failure);

        if (failure.status === 0 || failure.status >= 500) {
          // 寫入可能已完成；先要求人工查詢，不自動再新增一次。
          setUncertain(true);
          setReviewed(false);
        }
      }
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  }

  function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    void save();
  }

  if (error && (error.status === 401 || error.status === 403)) {
    return <RequestError error={error} />;
  }

  return (
    <fieldset disabled={busy} className={original ? "form-stack parcel-edit-form" : "form-stack parcel-registration-form"}>
      {error && <RequestError error={error} />}

      {uncertain && (
        <section className="notice notice-warning form-stack">
          <p>
            目前無法確認前次寫入結果。請先返回列表核對，
            避免因回應遺失而重複登記。
          </p>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
            />
            我已另外查詢並核對結果，仍需要再次送出
          </label>

          <button type="button" className="button" onClick={onClose}>
            關閉表單並查詢列表
          </button>
        </section>
      )}

      {warning ? (
        <section className="form-stack">
          <h3>已有相同物流公司與單號</h3>
          <p>請核對以下既有紀錄，確認仍需新增後再繼續。</p>

          {warning.records.map((parcel) => (
            <article key={parcel.id} className="panel">
              <ParcelSummary parcel={parcel} />
            </article>
          ))}

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={duplicateChecked}
              onChange={(event) =>
                setDuplicateChecked(event.target.checked)
              }
            />
            我已核對既有紀錄，確認仍要新增這件包裹
          </label>

          <div className="actions">
            <button
              type="button"
              className="button button-primary"
              disabled={
                busy ||
                !duplicateChecked ||
                (uncertain && !reviewed)
              }
              onClick={() => void save(true, warning.input)}
            >
              {busy ? "登記中…" : "確認仍要新增"}
            </button>

            <button
              type="button"
              className="button"
              onClick={() => {
                setWarning(null);
                setDuplicateChecked(false);
                setError(null);
              }}
            >
              返回修改
            </button>
          </div>
        </section>
      ) : (
        <>
          {original && <section className="panel">
            <h3>入住歸屬</h3>
            {target ? (
              <p>
                {target.unitLabel}・入住編號 {target.occupancy.id}
              </p>
            ) : (
              <p>尚未選擇入住。</p>
            )}

            {sourceEnded ? (
              <p className="notice">
                原入住已結束，可以更正允許的文字資料，
                但不能將舊包裹轉給新住戶。
              </p>
            ) : (
              <button
                type="button"
                className="button"
                onClick={() => setChoosing((value) => !value)}
              >
                {choosing ? "收合入住選擇" : "選擇／更換有效入住"}
              </button>
            )}
          </section>}

          {original ? (choosing && !sourceEnded && (
            <ParcelOccupancyPicker
              buildingId={buildingId}
              onSelect={(selected) => {
                setTarget(selected);
                setChoosing(false);
                setError(null);
              }}
            />
          )) : (
            <ParcelRegistrationPicker
              buildingId={buildingId}
              selected={target}
              disabled={busy}
              onClear={() => setTarget(null)}
              onSelect={(selected) => {
                setTarget(selected);
                setError(null);
              }}
            />
          )}

          <form onSubmit={submit} className="form-stack">
            <label>
              收件人姓名（必填，最多 100 字元）
              <input
                name="recipient_name"
                required
                value={draft.recipient_name}
                onChange={(event) =>
                  field("recipient_name", event.target.value)
                }
              />
            </label>

            <p className="muted">
              請填包裹標示的收件人；收件人不必等於簽收帳號姓名。
            </p>

            {([
              ["courier", "物流公司"],
              ["tracking_number", "物流單號"],
              ["storage_location", "存放位置"],
            ] as const).map(([name, label]) => (
              <label key={name}>
                {label}（選填，最多 100 字元）
                <input
                  name={name}
                  value={draft[name]}
                  onChange={(event) => field(name, event.target.value)}
                />
              </label>
            ))}

            <label>
              備註（選填）
              <textarea
                name="note"
                rows={2}
                value={draft.note}
                onChange={(event) => field("note", event.target.value)}
              />
            </label>

            {original && (
              <p className="notice notice-warning">
                資料實際變動時會取消等待中的取件驗證；
                只有更換入住歸屬時，才因本次更正換取件碼。
                包裹狀態仍由既有業務流程決定。
              </p>
            )}

            <button
              type="submit"
              className="button button-primary"
              disabled={
                busy ||
                !target ||
                (uncertain && !reviewed)
              }
            >
              {busy
                ? "處理中…"
                : original
                  ? "儲存更正"
                  : "登記包裹"}
            </button>
          </form>
        </>
      )}
    </fieldset>
  );
}
