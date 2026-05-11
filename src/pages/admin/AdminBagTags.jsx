import { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import Layout from "../../components/shared/Layout";
import { useDarkMode } from "../../hooks/useDarkMode";
import { getTheme } from "../../lib/theme";

export default function AdminBagTags() {
  const { darkMode } = useDarkMode();
  const t = getTheme(darkMode);
  const [members, setMembers] = useState([]);
  const [assigning, setAssigning] = useState(null);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // All styles inside component so t is in scope
  const hint = {
    fontSize: 14,
    color: t.textSub,
    marginTop: 0,
    marginBottom: "1rem",
  };
  const sectionHead = {
    fontSize: 12,
    fontWeight: 600,
    color: t.textSub,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    margin: "0.75rem 0 0.5rem",
  };
  const successBox = {
    background: t.successLight,
    color: t.success,
    padding: "0.75rem 1rem",
    borderRadius: 8,
    marginBottom: "0.75rem",
    fontSize: 14,
    cursor: "pointer",
  };
  const errorBox = {
    background: t.dangerLight,
    color: t.danger,
    padding: "0.75rem 1rem",
    borderRadius: 8,
    marginBottom: "0.75rem",
    fontSize: 14,
    cursor: "pointer",
  };

  useEffect(() => {
    loadMembers();
  }, []);

  async function loadMembers() {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, nickname, email, bag_tag_number")
      .order("bag_tag_number", { ascending: true, nullsFirst: false });
    setMembers(data ?? []);
  }

  async function assignTag(member) {
    setError(null);
    const newTag = tagInput === "" ? null : parseInt(tagInput);

    if (tagInput !== "" && (isNaN(newTag) || newTag < 1)) {
      setError("Tag number must be a positive number");
      return;
    }

    if (newTag !== null) {
      const conflict = members.find(
        (m) => m.bag_tag_number === newTag && m.id !== member.id,
      );
      if (conflict) {
        setError(
          `Tag #${newTag} is already held by ${conflict.nickname || conflict.full_name}`,
        );
        return;
      }
    }

    const { error } = await supabase
      .from("profiles")
      .update({ bag_tag_number: newTag })
      .eq("id", member.id);

    if (error) {
      setError(error.message);
      return;
    }

    if (newTag !== null) {
      await supabase.from("bag_tag_history").insert({
        tag_number: newTag,
        holder_id: member.id,
        notes: "Assigned by admin",
      });
    }

    setSuccess(`Tag updated for ${member.nickname || member.full_name}`);
    setAssigning(null);
    setTagInput("");
    loadMembers();
  }

  const tagged = members
    .filter((m) => m.bag_tag_number !== null)
    .sort((a, b) => a.bag_tag_number - b.bag_tag_number);
  const untagged = members.filter((m) => m.bag_tag_number === null);

  return (
    <Layout title="Bag tags">
      {success && (
        <div style={successBox} onClick={() => setSuccess(null)}>
          {success} ✕
        </div>
      )}
      {error && (
        <div style={errorBox} onClick={() => setError(null)}>
          {error} ✕
        </div>
      )}

      <p style={hint}>
        Assign tag numbers to members. Lower number = higher rank. Leave blank
        to remove a tag.
      </p>

      {tagged.length > 0 && (
        <>
          <div style={sectionHead}>Tag holders</div>
          {tagged.map((m) => (
            <MemberTagRow
              key={m.id}
              member={m}
              t={t}
              assigning={assigning}
              tagInput={tagInput}
              setAssigning={setAssigning}
              setTagInput={setTagInput}
              assignTag={assignTag}
            />
          ))}
        </>
      )}

      {untagged.length > 0 && (
        <>
          <div style={sectionHead}>No tag assigned</div>
          {untagged.map((m) => (
            <MemberTagRow
              key={m.id}
              member={m}
              t={t}
              assigning={assigning}
              tagInput={tagInput}
              setAssigning={setAssigning}
              setTagInput={setTagInput}
              assignTag={assignTag}
            />
          ))}
        </>
      )}
    </Layout>
  );
}

function MemberTagRow({
  member,
  t,
  assigning,
  tagInput,
  setAssigning,
  setTagInput,
  assignTag,
}) {
  const isEditing = assigning === member.id;

  // Styles here only use t passed as prop — safe
  const card = {
    background: t.card,
    borderRadius: 10,
    padding: "0.75rem 1rem",
    marginBottom: 8,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    boxShadow: t.shadow,
  };
  const cardLeft = { display: "flex", alignItems: "center", gap: 12 };
  const tagNum = {
    fontSize: 20,
    fontWeight: 800,
    color: t.accentText,
    width: 40,
    textAlign: "center",
  };
  const nameStyle = { fontWeight: 600, fontSize: 15, color: t.text };
  const emailStyle = { fontSize: 12, color: t.textSub };
  const editRow = { display: "flex", alignItems: "center", gap: 6 };
  const tagInp = {
    width: 70,
    padding: "0.4rem 0.5rem",
    borderRadius: 6,
    border: `1.5px solid ${t.inputBorder}`,
    fontSize: 15,
    textAlign: "center",
    background: t.input,
    color: t.text,
  };
  const saveBtn = {
    padding: "0.4rem 0.75rem",
    background: t.accent,
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
  };
  const cancelBtn = {
    padding: "0.4rem 0.5rem",
    background: t.cardAlt,
    border: "none",
    borderRadius: 6,
    fontSize: 13,
    cursor: "pointer",
    color: t.textSub,
  };
  const editBtn = {
    padding: "0.4rem 0.875rem",
    background: t.accentLight,
    color: t.accentText,
    border: `1.5px solid ${t.accent}`,
    borderRadius: 6,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  };

  return (
    <div style={card}>
      <div style={cardLeft}>
        <div style={tagNum}>
          {member.bag_tag_number ? `#${member.bag_tag_number}` : "–"}
        </div>
        <div>
          <div style={nameStyle}>{member.nickname || member.full_name}</div>
          <div style={emailStyle}>{member.email}</div>
        </div>
      </div>

      {isEditing ? (
        <div style={editRow}>
          <input
            style={tagInp}
            type="number"
            min={1}
            placeholder="Tag #"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            autoFocus
          />
          <button style={saveBtn} onClick={() => assignTag(member)}>
            Save
          </button>
          <button
            style={cancelBtn}
            onClick={() => {
              setAssigning(null);
              setTagInput("");
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <button
          style={editBtn}
          onClick={() => {
            setAssigning(member.id);
            setTagInput(member.bag_tag_number ?? "");
          }}
        >
          {member.bag_tag_number ? "Change" : "Assign"}
        </button>
      )}
    </div>
  );
}
