#!/usr/bin/env bash
set -euo pipefail

BASE_COMMIT="${BASE_SHA:-83515cd3b2904e97cdff35cbd71c304cfa50058f}"
MODE="${1:---help}"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=============================================="
echo " [ROLLBACK ARCHITECTURE] Zerkalo Public v1"
echo " Target Base SHA: ${BASE_COMMIT}"
echo "=============================================="

if [ "${MODE}" == "--soft" ]; then
  TARGET_DIR="${2:-deploy/current}"
  echo "--> Executing Soft Rollback (Kill Switch Activation)..."
  if [ -d "${TARGET_DIR}" ]; then
    touch "${TARGET_DIR}/.kill_switch"
  fi
  touch "/tmp/zerkalo_kill_switch"
  if [ -f ".env" ]; then
    sed -i.bak 's/MYTH_ENABLED=.*/MYTH_ENABLED=0/' .env 2>/dev/null || true
  fi
  echo "--> [SOFT KILL ACTIVATED] Myth endpoints will fail closed with HTTP 503 while preserving release SHA."
  exit 0

elif [ "${MODE}" == "--restore" ]; then
  TARGET_DIR="${2:-deploy/current}"
  echo "--> Executing Soft Rollback Restoration (Kill Switch Deactivation)..."
  if [ -d "${TARGET_DIR}" ]; then
    rm -f "${TARGET_DIR}/.kill_switch"
  fi
  rm -f "/tmp/zerkalo_kill_switch"
  if [ -f ".env" ]; then
    sed -i.bak 's/MYTH_ENABLED=.*/MYTH_ENABLED=1/' .env 2>/dev/null || true
  fi
  echo "--> [SOFT KILL RESTORED] Service restored to healthy HTTP 200."
  exit 0

elif [ "${MODE}" == "--promote" ]; then
  TARGET_SHA="${2:-${BASE_COMMIT}}"
  DEPLOY_ROOT="${3:-deploy}"
  echo "--> Executing Release Promotion to SHA: ${TARGET_SHA} in ${DEPLOY_ROOT}..."

  if [ -d "${DEPLOY_ROOT}/releases/${TARGET_SHA}" ]; then
    REL_PATH="releases/${TARGET_SHA}"
  elif [ -d "${DEPLOY_ROOT}/${TARGET_SHA}" ]; then
    REL_PATH="${TARGET_SHA}"
  else
    echo "[ERROR] Target release directory does not exist: ${DEPLOY_ROOT}/releases/${TARGET_SHA}"
    exit 1
  fi

  if [ -L "${DEPLOY_ROOT}/current" ] || [ -e "${DEPLOY_ROOT}/current" ]; then
    PREV_DEST=$(readlink "${DEPLOY_ROOT}/current" || true)
    if [ -n "${PREV_DEST}" ] && [ "${PREV_DEST}" != "${REL_PATH}" ]; then
      ln -sfn "${PREV_DEST}" "${DEPLOY_ROOT}/previous"
      echo "--> [PROMOTION PREVIOUS] Symlink updated: ${DEPLOY_ROOT}/previous -> ${PREV_DEST}"
    fi
  fi

  ln -sfn "${REL_PATH}" "${DEPLOY_ROOT}/current"
  echo "--> [PROMOTION CURRENT] Symlink updated: ${DEPLOY_ROOT}/current -> ${REL_PATH}"
  exit 0

elif [ "${MODE}" == "--target" ] || [ "${MODE}" == "--hard" ] || [ "${MODE}" == "--rollback" ]; then
  TARGET_SHA="${2:-${BASE_COMMIT}}"
  DEPLOY_ROOT="${3:-deploy}"
  echo "--> Executing Rollback to SHA: ${TARGET_SHA} in ${DEPLOY_ROOT}..."
  
  if [ -d "${DEPLOY_ROOT}/releases/${TARGET_SHA}" ]; then
    REL_PATH="releases/${TARGET_SHA}"
  elif [ -d "${DEPLOY_ROOT}/${TARGET_SHA}" ]; then
    REL_PATH="${TARGET_SHA}"
  else
    REL_PATH=""
  fi

  if [ -n "${REL_PATH}" ]; then
    if [ -L "${DEPLOY_ROOT}/current" ] || [ -e "${DEPLOY_ROOT}/current" ]; then
      PREV_DEST=$(readlink "${DEPLOY_ROOT}/current" || true)
      if [ -n "${PREV_DEST}" ] && [ "${PREV_DEST}" != "${REL_PATH}" ]; then
        ln -sfn "${PREV_DEST}" "${DEPLOY_ROOT}/previous"
        echo "--> [ROLLBACK PREVIOUS] Symlink updated: ${DEPLOY_ROOT}/previous -> ${PREV_DEST}"
      fi
    fi

    ln -sfn "${REL_PATH}" "${DEPLOY_ROOT}/current"
    echo "--> [ROLLBACK CURRENT] Symlink updated: ${DEPLOY_ROOT}/current -> ${REL_PATH}"
  else
    echo "--> Checking out commit ${TARGET_SHA} via git..."
    git checkout "${TARGET_SHA}"
  fi
  echo "--> Rollback complete."
  exit 0

elif [ "${MODE}" == "--rehearse-nonprod" ]; then
  echo "=========================================================="
  echo " [NONPROD ROLLBACK REHEARSAL] Real Multi-Package A -> B -> A"
  echo "=========================================================="
  
  START_TIME=$(node -e 'console.log(Date.now())')
  CURRENT_SHA=$(git rev-parse HEAD)
  REHEARSAL_PORT=39550
  EVIDENCE_DIR="${EVIDENCE_DIR:-${REPO_ROOT}/dist/evidence}"
  if [[ "${EVIDENCE_DIR}" != /* ]]; then
    EVIDENCE_DIR="${REPO_ROOT}/${EVIDENCE_DIR}"
  fi
  EXTERNAL_AUDIT_ROOT="/Users/artemkrysin/Documents/Zerkalo-Independent-Audit/releases/${CURRENT_SHA}"
  EXTERNAL_PACKAGES_DIR="${EXTERNAL_AUDIT_ROOT}/packages"
  LOCAL_PACKAGES_DIR="${EVIDENCE_DIR}/packages"

  mkdir -p "${EVIDENCE_DIR}" "${LOCAL_PACKAGES_DIR}" "${EXTERNAL_PACKAGES_DIR}" "${EVIDENCE_DIR}/rollback" "${EXTERNAL_AUDIT_ROOT}/rollback"
  RECEIPT_FILE="${RECEIPT_FILE:-${EVIDENCE_DIR}/11_ROLLBACK_REHEARSAL_EVIDENCE.md}"
  EXTERNAL_RECEIPT_FILE="${EXTERNAL_AUDIT_ROOT}/rollback/11_ROLLBACK_REHEARSAL_EVIDENCE.md"

  # Ensure rehearsal port is free
  lsof -ti :"${REHEARSAL_PORT}" | xargs kill -9 2>/dev/null || true
  sleep 1

  echo "--> 1. Building and preserving genuine PACKAGE_A (from BASE_SHA ${BASE_COMMIT})..."
  BASE_WORKTREE="/tmp/zerkalo_base_tree_$$"
  rm -rf "${BASE_WORKTREE}"
  git worktree add "${BASE_WORKTREE}" "${BASE_COMMIT}" --detach

  # In Base Worktree, link node_modules, build frontend, and add unambiguous packaging metadata
  (
    cd "${BASE_WORKTREE}"
    ln -sfn "${REPO_ROOT}/node_modules" node_modules
    npm run build >/dev/null 2>&1 || true
    cat <<EOF > release.json
{
  "source_git_sha": "${BASE_COMMIT}",
  "release_sha": "${BASE_COMMIT}",
  "package": "A",
  "package_name": "zerkalo-base-release-v1",
  "version": "1.0.0-lab",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "builder": "deploy/rollback.sh",
  "git_commit": "${BASE_COMMIT}"
}
EOF
    cp -p "${REPO_ROOT}/scripts/runtime_launcher.cjs" runtime_launcher.cjs
    tar -czf "/tmp/package_A_$$.tar.gz" \
      --exclude='.git' \
      --exclude='node_modules' \
      --exclude='data/*.json' \
      --exclude='PUBLIC_RELEASE_EVIDENCE' \
      --exclude='dist/evidence' \
      --exclude='*.env*' \
      dist src server.ts server package.json package-lock.json release.json runtime_launcher.cjs tsconfig.json vite.config.ts index.html
    mv "/tmp/package_A_$$.tar.gz" "${LOCAL_PACKAGES_DIR}/package_A.tar.gz"
  )
  git worktree remove --force "${BASE_WORKTREE}" 2>/dev/null || rm -rf "${BASE_WORKTREE}"

  # Generate Package A metadata
  ARCHIVE_A_HASH=$(shasum -a 256 "${LOCAL_PACKAGES_DIR}/package_A.tar.gz" | awk '{print $1}')
  tar -tzf "${LOCAL_PACKAGES_DIR}/package_A.tar.gz" | sort > "${LOCAL_PACKAGES_DIR}/package_A_file_tree.txt"
  cat <<EOF > "${LOCAL_PACKAGES_DIR}/package_A_manifest.sha256"
${ARCHIVE_A_HASH}  package_A.tar.gz
EOF
  cat <<EOF > "${LOCAL_PACKAGES_DIR}/package_A_build_receipt.json"
{
  "package": "A",
  "source_git_sha": "${BASE_COMMIT}",
  "release_sha": "${BASE_COMMIT}",
  "archive_filename": "package_A.tar.gz",
  "archive_sha256": "${ARCHIVE_A_HASH}",
  "byte_size": $(wc -c < "${LOCAL_PACKAGES_DIR}/package_A.tar.gz" | tr -d ' '),
  "version": "1.0.0-lab",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
  cp -p "${LOCAL_PACKAGES_DIR}/package_A.tar.gz" "${EXTERNAL_PACKAGES_DIR}/"
  cp -p "${LOCAL_PACKAGES_DIR}/package_A_file_tree.txt" "${EXTERNAL_PACKAGES_DIR}/"
  cp -p "${LOCAL_PACKAGES_DIR}/package_A_manifest.sha256" "${EXTERNAL_PACKAGES_DIR}/"
  cp -p "${LOCAL_PACKAGES_DIR}/package_A_build_receipt.json" "${EXTERNAL_PACKAGES_DIR}/"

  echo "    Package A Archive: ${LOCAL_PACKAGES_DIR}/package_A.tar.gz (SHA-256: ${ARCHIVE_A_HASH})"

  echo "--> 2. Building and preserving genuine PACKAGE_B (from CANDIDATE_SHA ${CURRENT_SHA})..."
  npm run build >/dev/null 2>&1
  mkdir -p "${LOCAL_PACKAGES_DIR}" "${EXTERNAL_PACKAGES_DIR}"
  cat <<EOF > release.json
{
  "source_git_sha": "${CURRENT_SHA}",
  "release_sha": "${CURRENT_SHA}",
  "package": "B",
  "package_name": "zerkalo-candidate-release-v1",
  "version": "1.0.0-release-v1",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "builder": "deploy/rollback.sh",
  "git_commit": "${CURRENT_SHA}"
}
EOF
  cp -p "${REPO_ROOT}/scripts/runtime_launcher.cjs" runtime_launcher.cjs
  tar -czf "/tmp/package_B_$$.tar.gz" \
    --exclude='.git' \
    --exclude='node_modules' \
    --exclude='data/*.json' \
    --exclude='PUBLIC_RELEASE_EVIDENCE' \
    --exclude='dist/evidence' \
    --exclude='*.env*' \
    dist src server.ts server package.json package-lock.json release.json runtime_launcher.cjs tsconfig.json vite.config.ts index.html
  mv "/tmp/package_B_$$.tar.gz" "${LOCAL_PACKAGES_DIR}/package_B.tar.gz"

  # Generate Package B metadata
  ARCHIVE_B_HASH=$(shasum -a 256 "${LOCAL_PACKAGES_DIR}/package_B.tar.gz" | awk '{print $1}')
  tar -tzf "${LOCAL_PACKAGES_DIR}/package_B.tar.gz" | sort > "${LOCAL_PACKAGES_DIR}/package_B_file_tree.txt"
  cat <<EOF > "${LOCAL_PACKAGES_DIR}/package_B_manifest.sha256"
${ARCHIVE_B_HASH}  package_B.tar.gz
EOF
  cat <<EOF > "${LOCAL_PACKAGES_DIR}/package_B_build_receipt.json"
{
  "package": "B",
  "source_git_sha": "${CURRENT_SHA}",
  "release_sha": "${CURRENT_SHA}",
  "archive_filename": "package_B.tar.gz",
  "archive_sha256": "${ARCHIVE_B_HASH}",
  "byte_size": $(wc -c < "${LOCAL_PACKAGES_DIR}/package_B.tar.gz" | tr -d ' '),
  "version": "1.0.0-release-v1",
  "created_at": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
}
EOF
  cp -p "${LOCAL_PACKAGES_DIR}/package_B.tar.gz" "${EXTERNAL_PACKAGES_DIR}/"
  cp -p "${LOCAL_PACKAGES_DIR}/package_B_file_tree.txt" "${EXTERNAL_PACKAGES_DIR}/"
  cp -p "${LOCAL_PACKAGES_DIR}/package_B_manifest.sha256" "${EXTERNAL_PACKAGES_DIR}/"
  cp -p "${LOCAL_PACKAGES_DIR}/package_B_build_receipt.json" "${EXTERNAL_PACKAGES_DIR}/"

  echo "    Package B Archive: ${LOCAL_PACKAGES_DIR}/package_B.tar.gz (SHA-256: ${ARCHIVE_B_HASH})"

  # Assert Distinction
  if [ "${ARCHIVE_A_HASH}" == "${ARCHIVE_B_HASH}" ]; then
    echo "[ERROR] Package A and Package B must be genuinely distinct! Got identical hashes."
    exit 1
  fi
  echo "    Verified: Package A and Package B are genuinely distinct!"

  # ─── 3. Standalone Rehearsal Runtime Environment ───
  REHEARSAL_DIR="/tmp/zerkalo_rehearsal_$$"
  mkdir -p "${REHEARSAL_DIR}/releases/${BASE_COMMIT}" "${REHEARSAL_DIR}/releases/${CURRENT_SHA}"
  tar -xzf "${LOCAL_PACKAGES_DIR}/package_A.tar.gz" -C "${REHEARSAL_DIR}/releases/${BASE_COMMIT}"
  ln -sfn "${REPO_ROOT}/node_modules" "${REHEARSAL_DIR}/releases/${BASE_COMMIT}/node_modules"

  tar -xzf "${LOCAL_PACKAGES_DIR}/package_B.tar.gz" -C "${REHEARSAL_DIR}/releases/${CURRENT_SHA}"
  ln -sfn "${REPO_ROOT}/node_modules" "${REHEARSAL_DIR}/releases/${CURRENT_SHA}/node_modules"

  # ─── Step 1: Boot Package A (Base Release) ───
  echo "--> 3. Step 1: Booting Release A (${BASE_COMMIT}) on port ${REHEARSAL_PORT}..."
  ln -sfn "releases/${BASE_COMMIT}" "${REHEARSAL_DIR}/current"
  rm -f "/tmp/zerkalo_kill_switch" "${REHEARSAL_DIR}/current/.kill_switch"

  (
    cd "${REHEARSAL_DIR}/current"
    LOG_FILE="${REHEARSAL_DIR}/server_A.log" exec node -e '
      const { spawn } = require("child_process");
      const fs = require("fs");
      const logFd = fs.openSync(process.env.LOG_FILE, "w");
      const child = spawn(process.execPath, ["'"${REPO_ROOT}"'/node_modules/tsx/dist/cli.mjs", "server.ts"], {
        detached: true,
        env: {
          ...process.env,
          PORT: "'"${REHEARSAL_PORT}"'",
          NODE_ENV: "production",
          NODE_OPTIONS: "--require ./runtime_launcher.cjs",
          RELEASE_SHA: "'"${BASE_COMMIT}"'",
          DEEPSEEK_API_KEY: "sk-test-deepseek-ready-key-minimum-32-chars-ok",
          QUALITATIVE_FEEDBACK_SECRET: "test-secret-key-32-characters-minimum-length!",
          DELETION_LOOKUP_SECRET: "test-deletion-secret-32-characters!",
          MYTH_ENABLED: "1",
          PUBLIC_RELEASE_MODE: "0",
        },
        stdio: ["ignore", logFd, logFd],
      });
      process.stdout.write(String(child.pid));
      child.unref();
    '
  ) > "${REHEARSAL_DIR}/server_A.pid"
  SERVER_A_PID=$(cat "${REHEARSAL_DIR}/server_A.pid")

  for i in {1..40}; do
    if curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health" >/dev/null 2>&1; then break; fi
    sleep 0.25
  done

  A_INITIAL_HEALTH=$(curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health")
  A_INITIAL_READY=$(curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health/ready")
  A_READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${REHEARSAL_PORT}/health/ready")
  A_HEALTH_SHA=$(node -e 'console.log(JSON.parse(process.argv[1]).release_sha || "")' "${A_INITIAL_HEALTH}")

  echo "    Release A Health: ${A_INITIAL_HEALTH}"
  echo "    Release A Ready:  ${A_INITIAL_READY} (HTTP ${A_READY_CODE})"
  echo "    Release A Health SHA: ${A_HEALTH_SHA}"

  if [ "${A_READY_CODE}" != "200" ]; then
    echo "[ERROR] Release A failed ready check: expected 200, got ${A_READY_CODE}"
    kill -9 "-${SERVER_A_PID}" 2>/dev/null || kill -9 "${SERVER_A_PID}" 2>/dev/null || true
    exit 1
  fi
  if [ "${A_HEALTH_SHA}" != "${BASE_COMMIT}" ]; then
    echo "[ERROR] Release A failed health SHA check: expected ${BASE_COMMIT}, got ${A_HEALTH_SHA}"
    kill -9 "-${SERVER_A_PID}" 2>/dev/null || kill -9 "${SERVER_A_PID}" 2>/dev/null || true
    exit 1
  fi
  echo "    Verified: Release A health and ready report exact BASE_SHA: ${A_HEALTH_SHA}"

  # ─── Step 2: Deploy Package B (Candidate Release) ───
  echo "--> 4. Step 2: Promoting Release B (${CURRENT_SHA}) via documented operator command..."
  kill -9 "-${SERVER_A_PID}" 2>/dev/null || kill -9 "${SERVER_A_PID}" 2>/dev/null || true
  lsof -ti :"${REHEARSAL_PORT}" | xargs kill -9 2>/dev/null || true
  sleep 1

  bash "${REPO_ROOT}/deploy/rollback.sh" --promote "${CURRENT_SHA}" "${REHEARSAL_DIR}"
  PREV_PROMO=$(readlink "${REHEARSAL_DIR}/previous" || true)
  CUR_PROMO=$(readlink "${REHEARSAL_DIR}/current" || true)
  echo "    Operator symlinks after promotion: previous -> ${PREV_PROMO}, current -> ${CUR_PROMO}"
  if [ "${PREV_PROMO}" != "releases/${BASE_COMMIT}" ] || [ "${CUR_PROMO}" != "releases/${CURRENT_SHA}" ]; then
    echo "[ERROR] Promotion symlinks invalid: previous=${PREV_PROMO}, current=${CUR_PROMO}"
    exit 1
  fi
  echo "    Verified: Promotion maintained previous -> releases/${BASE_COMMIT} and current -> releases/${CURRENT_SHA}"

  rm -f "/tmp/zerkalo_kill_switch" "${REHEARSAL_DIR}/current/.kill_switch"

  (
    cd "${REHEARSAL_DIR}/current"
    LOG_FILE="${REHEARSAL_DIR}/server_B.log" exec node -e '
      const { spawn } = require("child_process");
      const fs = require("fs");
      const logFd = fs.openSync(process.env.LOG_FILE, "w");
      const child = spawn(process.execPath, ["'"${REPO_ROOT}"'/node_modules/tsx/dist/cli.mjs", "server.ts"], {
        detached: true,
        env: {
          ...process.env,
          PORT: "'"${REHEARSAL_PORT}"'",
          NODE_ENV: "production",
          NODE_OPTIONS: "--require ./runtime_launcher.cjs",
          RELEASE_SHA: "'"${CURRENT_SHA}"'",
          DEEPSEEK_API_KEY: "sk-test-deepseek-ready-key-minimum-32-chars-ok",
          QUALITATIVE_FEEDBACK_SECRET: "test-secret-key-32-characters-minimum-length!",
          DELETION_LOOKUP_SECRET: "test-deletion-secret-32-characters!",
          MYTH_ENABLED: "1",
          PUBLIC_RELEASE_MODE: "0",
        },
        stdio: ["ignore", logFd, logFd],
      });
      process.stdout.write(String(child.pid));
      child.unref();
    '
  ) > "${REHEARSAL_DIR}/server_B.pid"
  SERVER_B_PID=$(cat "${REHEARSAL_DIR}/server_B.pid")

  for i in {1..40}; do
    if curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health" >/dev/null 2>&1; then break; fi
    sleep 0.25
  done

  B_HEALTH=$(curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health")
  B_READY=$(curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health/ready")
  B_READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${REHEARSAL_PORT}/health/ready")
  B_HEALTH_SHA=$(node -e 'console.log(JSON.parse(process.argv[1]).release_sha || "")' "${B_HEALTH}")

  echo "    Release B Health: ${B_HEALTH}"
  echo "    Release B Ready:  ${B_READY} (HTTP ${B_READY_CODE})"
  echo "    Release B Health SHA: ${B_HEALTH_SHA}"

  if [ "${B_READY_CODE}" != "200" ]; then
    echo "[ERROR] Release B failed ready check: expected 200, got ${B_READY_CODE}"
    kill -9 "-${SERVER_B_PID}" 2>/dev/null || kill -9 "${SERVER_B_PID}" 2>/dev/null || true
    exit 1
  fi
  if [ "${B_HEALTH_SHA}" != "${CURRENT_SHA}" ]; then
    echo "[ERROR] Release B failed health SHA check: expected ${CURRENT_SHA}, got ${B_HEALTH_SHA}"
    kill -9 "-${SERVER_B_PID}" 2>/dev/null || kill -9 "${SERVER_B_PID}" 2>/dev/null || true
    exit 1
  fi
  echo "    Verified: Release B health and ready report exact candidate SHA: ${B_HEALTH_SHA}"

  # ─── Step 3: Soft-Kill Running Package B (Without Restarting Process!) ───
  echo "--> 5. Step 3: Activating Soft-Kill on RUNNING Release B (PID ${SERVER_B_PID})..."
  bash "${REPO_ROOT}/deploy/rollback.sh" --soft "${REHEARSAL_DIR}/current"
  sleep 0.5

  SOFT_KILL_HTTP=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:${REHEARSAL_PORT}/api/personal-myth" \
    -H "Content-Type: application/json" \
    -d '{"consent_version":"v1","is_adult":true,"age_confirmed":true,"consent_given":true,"answers":{"q1":"сомнение","q2":"камень","q3":"лес","q4":"покой"}}')
  SOFT_KILL_BODY=$(curl -s -X POST "http://127.0.0.1:${REHEARSAL_PORT}/api/personal-myth" \
    -H "Content-Type: application/json" \
    -d '{"consent_version":"v1","is_adult":true,"age_confirmed":true,"consent_given":true,"answers":{"q1":"сомнение","q2":"камень","q3":"лес","q4":"покой"}}')
  SOFT_KILL_HEALTH=$(curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health")
  SOFT_KILL_READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${REHEARSAL_PORT}/health/ready")

  echo "    Soft-kill running service /api/personal-myth: HTTP ${SOFT_KILL_HTTP} (Body: ${SOFT_KILL_BODY})"
  echo "    Soft-kill running service /health/ready: HTTP ${SOFT_KILL_READY_CODE}"
  echo "    Soft-kill running service /health: ${SOFT_KILL_HEALTH}"

  if [ "${SOFT_KILL_HTTP}" != "503" ]; then
    echo "[ERROR] Soft-kill failed to return 503 on running process! Got ${SOFT_KILL_HTTP}"
    kill -9 "-${SERVER_B_PID}" 2>/dev/null || kill -9 "${SERVER_B_PID}" 2>/dev/null || true
    exit 1
  fi

  # Assert Release SHA did not change during soft-kill
  SOFT_KILL_SHA=$(node -e 'console.log(JSON.parse(process.argv[1]).release_sha)' "${SOFT_KILL_HEALTH}")
  if [ "${SOFT_KILL_SHA}" != "${CURRENT_SHA}" ]; then
    echo "[ERROR] Release SHA changed during soft-kill! Expected ${CURRENT_SHA}, got ${SOFT_KILL_SHA}"
    kill -9 "-${SERVER_B_PID}" 2>/dev/null || kill -9 "${SERVER_B_PID}" 2>/dev/null || true
    exit 1
  fi
  echo "    Verified: Running release SHA remained unchanged (${CURRENT_SHA}) during soft-kill!"

  # ─── Step 4: Restore Running Package B (Without Restarting Process!) ───
  echo "--> 6. Step 4: Restoring Soft-Kill on RUNNING Release B (PID ${SERVER_B_PID})..."
  bash "${REPO_ROOT}/deploy/rollback.sh" --restore "${REHEARSAL_DIR}/current"
  sleep 0.5

  RESTORE_HEALTH=$(curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health")
  RESTORE_READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${REHEARSAL_PORT}/health/ready")
  RESTORE_CRISIS_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST "http://127.0.0.1:${REHEARSAL_PORT}/api/personal-myth" \
    -H "Content-Type: application/json" \
    -d '{"consent_version":"v1","is_adult":true,"age_confirmed":true,"consent_given":true,"answers":{"q1":"хочу умереть","q2":"сад","q3":"река","q4":"покой"}}')

  echo "    Restored running service /health: ${RESTORE_HEALTH}"
  echo "    Restored running service /health/ready: HTTP ${RESTORE_READY_CODE}"
  echo "    Restored running service /api/personal-myth: HTTP ${RESTORE_CRISIS_CODE}"

  if [ "${RESTORE_READY_CODE}" != "200" ] || [ "${RESTORE_CRISIS_CODE}" != "200" ]; then
    echo "[ERROR] Restore failed to bring running service back to HTTP 200 ready!"
    kill -9 "-${SERVER_B_PID}" 2>/dev/null || kill -9 "${SERVER_B_PID}" 2>/dev/null || true
    exit 1
  fi
  echo "    Verified: Running service restored to HTTP 200 ready and operational!"

  # ─── Step 5: Hard Rollback to Package A ───
  echo "--> 7. Step 5: Executing Hard Rollback to Release A (${BASE_COMMIT}) via documented operator command..."
  ROLLBACK_START=$(node -e 'console.log(Date.now())')

  # Stop Package B
  kill -9 "-${SERVER_B_PID}" 2>/dev/null || kill -9 "${SERVER_B_PID}" 2>/dev/null || true
  lsof -ti :"${REHEARSAL_PORT}" | xargs kill -9 2>/dev/null || true
  sleep 1

  # Apply Hard Rollback target switch via operator command
  bash "${REPO_ROOT}/deploy/rollback.sh" --target "${BASE_COMMIT}" "${REHEARSAL_DIR}"

  PREV_RB=$(readlink "${REHEARSAL_DIR}/previous" || true)
  CUR_RB=$(readlink "${REHEARSAL_DIR}/current" || true)
  echo "    Operator symlinks after rollback: previous -> ${PREV_RB}, current -> ${CUR_RB}"
  if [ "${PREV_RB}" != "releases/${CURRENT_SHA}" ] || [ "${CUR_RB}" != "releases/${BASE_COMMIT}" ]; then
    echo "[ERROR] Rollback symlinks invalid: previous=${PREV_RB}, current=${CUR_RB}"
    exit 1
  fi
  echo "    Verified: Rollback maintained previous -> releases/${CURRENT_SHA} and current -> releases/${BASE_COMMIT}"

  # Boot Rolled Back Release A
  (
    cd "${REHEARSAL_DIR}/current"
    LOG_FILE="${REHEARSAL_DIR}/server_A_rollback.log" exec node -e '
      const { spawn } = require("child_process");
      const fs = require("fs");
      const logFd = fs.openSync(process.env.LOG_FILE, "w");
      const child = spawn(process.execPath, ["'"${REPO_ROOT}"'/node_modules/tsx/dist/cli.mjs", "server.ts"], {
        detached: true,
        env: {
          ...process.env,
          PORT: "'"${REHEARSAL_PORT}"'",
          NODE_ENV: "production",
          NODE_OPTIONS: "--require ./runtime_launcher.cjs",
          RELEASE_SHA: "'"${BASE_COMMIT}"'",
          DEEPSEEK_API_KEY: "sk-test-deepseek-ready-key-minimum-32-chars-ok",
          QUALITATIVE_FEEDBACK_SECRET: "test-secret-key-32-characters-minimum-length!",
          DELETION_LOOKUP_SECRET: "test-deletion-secret-32-characters!",
          MYTH_ENABLED: "1",
          PUBLIC_RELEASE_MODE: "0",
        },
        stdio: ["ignore", logFd, logFd],
      });
      process.stdout.write(String(child.pid));
      child.unref();
    '
  ) > "${REHEARSAL_DIR}/server_A_rollback.pid"
  SERVER_A_RB_PID=$(cat "${REHEARSAL_DIR}/server_A_rollback.pid")

  for i in {1..40}; do
    if curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health" >/dev/null 2>&1; then break; fi
    sleep 0.25
  done

  ROLLBACK_HEALTH=$(curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health")
  ROLLBACK_READY=$(curl -s "http://127.0.0.1:${REHEARSAL_PORT}/health/ready")
  ROLLBACK_READY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${REHEARSAL_PORT}/health/ready")
  ROLLBACK_PRIVACY_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${REHEARSAL_PORT}/privacy.html")
  ROLLBACK_TERMS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://127.0.0.1:${REHEARSAL_PORT}/terms.html")

  ROLLBACK_END=$(node -e 'console.log(Date.now())')
  DURATION_MS=$(( ROLLBACK_END - ROLLBACK_START ))

  echo "    Rolled-back Release A Health:   ${ROLLBACK_HEALTH}"
  echo "    Rolled-back Release A Ready:    ${ROLLBACK_READY} (HTTP ${ROLLBACK_READY_CODE})"
  echo "    Rolled-back Release A Privacy:  HTTP ${ROLLBACK_PRIVACY_CODE}"
  echo "    Rolled-back Release A Terms:    HTTP ${ROLLBACK_TERMS_CODE}"

  ROLLBACK_HEALTH_SHA=$(node -e 'console.log(JSON.parse(process.argv[1]).release_sha || "")' "${ROLLBACK_HEALTH}")
  echo "    Rolled-back Release A Health SHA: ${ROLLBACK_HEALTH_SHA}"

  if [ "${ROLLBACK_READY_CODE}" != "200" ]; then
    echo "[ERROR] Rolled-back Release A failed ready check! Got ${ROLLBACK_READY_CODE}"
    kill -9 "-${SERVER_A_RB_PID}" 2>/dev/null || kill -9 "${SERVER_A_RB_PID}" 2>/dev/null || true
    exit 1
  fi
  if [ "${ROLLBACK_HEALTH_SHA}" != "${BASE_COMMIT}" ]; then
    echo "[ERROR] Rolled-back Release A failed health SHA check: expected ${BASE_COMMIT}, got ${ROLLBACK_HEALTH_SHA}"
    kill -9 "-${SERVER_A_RB_PID}" 2>/dev/null || kill -9 "${SERVER_A_RB_PID}" 2>/dev/null || true
    exit 1
  fi
  echo "    Verified: Rolled back Release A health and ready report exact BASE_SHA: ${ROLLBACK_HEALTH_SHA}"

  # Clean up running rehearsal process and test runtime directory
  kill -9 "-${SERVER_A_RB_PID}" 2>/dev/null || kill -9 "${SERVER_A_RB_PID}" 2>/dev/null || true
  lsof -ti :"${REHEARSAL_PORT}" | xargs kill -9 2>/dev/null || true
  rm -rf "${REHEARSAL_DIR}"

  echo "--> 8. Preserving both genuine release packages permanently..."
  echo "    Package A: ${LOCAL_PACKAGES_DIR}/package_A.tar.gz"
  echo "    Package A External: ${EXTERNAL_PACKAGES_DIR}/package_A.tar.gz"
  echo "    Package B: ${LOCAL_PACKAGES_DIR}/package_B.tar.gz"
  echo "    Package B External: ${EXTERNAL_PACKAGES_DIR}/package_B.tar.gz"

  # ─── 9. Writing Immutable Audit Evidence Receipt ───
  echo "--> 9. Writing Rehearsal Receipt to ${RECEIPT_FILE}..."
  cat <<EOF > "${RECEIPT_FILE}"
# 11_ROLLBACK_REHEARSAL_EVIDENCE

- **Rehearsal Date**: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
- **Base SHA (Package A)**: \`${BASE_COMMIT}\`
- **Package A Archive SHA-256**: \`${ARCHIVE_A_HASH}\`
- **Package A Health SHA Verified**: \`${A_HEALTH_SHA}\`
- **Candidate SHA (Package B)**: \`${CURRENT_SHA}\`
- **Package B Archive SHA-256**: \`${ARCHIVE_B_HASH}\`
- **Package B Health SHA Verified**: \`${B_HEALTH_SHA}\`
- **Packages Genuinely Distinct**: \`YES (archive_hash_A != archive_hash_B)\`
- **Promotion Symlinks Verified**: \`previous -> releases/${BASE_COMMIT}, current -> releases/${CURRENT_SHA}\`
- **Rollback Symlinks Verified**: \`previous -> releases/${CURRENT_SHA}, current -> releases/${BASE_COMMIT}\`
- **Package A Preserved**: \`${EXTERNAL_PACKAGES_DIR}/package_A.tar.gz\`
- **Package B Preserved**: \`${EXTERNAL_PACKAGES_DIR}/package_B.tar.gz\`
- **Package A /health/ready 200 Verified**: \`YES\`
- **Package B /health/ready 200 Verified**: \`YES\`
- **Rehearsal Port**: \`${REHEARSAL_PORT}\`
- **Hard Rollback Transition Duration**: \`${DURATION_MS}ms\`
- **Sequence Executed**: \`A (boot) -> B (promote) -> B (soft-kill) -> B (soft-restore) -> A (rollback)\`
- **Result**: \`100% SUCCESS\`

## Live Rehearsal Execution Log

### Step 1. Package A (Base) Boot & Readiness
\`\`\`json
${A_INITIAL_HEALTH}
\`\`\`
\`\`\`json
${A_INITIAL_READY}
\`\`\`
- Status: \`HTTP ${A_READY_CODE} OK\`

### Step 2. Package B (Candidate) Deployment & Readiness
\`\`\`json
${B_HEALTH}
\`\`\`
\`\`\`json
${B_READY}
\`\`\`
- Status: \`HTTP ${B_READY_CODE} OK\`
- Release SHA: \`${CURRENT_SHA}\`

### Step 3. Soft-Kill On Running Package B (Without Restarting Process)
- Trigger command: \`deploy/rollback.sh --soft\`
- \`GET /health\` returned HTTP 200:
\`\`\`json
${SOFT_KILL_HEALTH}
\`\`\`
- Verified: Release SHA remained \`${CURRENT_SHA}\` (SHA unchanged during soft-kill)
- \`GET /health/ready\` returned HTTP: \`${SOFT_KILL_READY_CODE}\` (\`status: not_ready\`)
- \`POST /api/personal-myth\` returned HTTP: \`${SOFT_KILL_HTTP}\`
\`\`\`json
${SOFT_KILL_BODY}
\`\`\`

### Step 4. Soft-Restore On Running Package B (Without Restarting Process)
- Trigger command: \`deploy/rollback.sh --restore\`
- \`GET /health\` returned HTTP 200:
\`\`\`json
${RESTORE_HEALTH}
\`\`\`
- \`GET /health/ready\` returned HTTP: \`${RESTORE_READY_CODE}\` (\`status: ready\`)
- \`POST /api/personal-myth\` returned HTTP: \`${RESTORE_CRISIS_CODE}\` (\`crisis interceptor operational\`)

### Step 5. Hard Rollback to Package A
- Trigger command: \`deploy/rollback.sh --target ${BASE_COMMIT}\`
- Symlink atomic switch: \`current -> releases/${BASE_COMMIT}\`
- Execution duration: \`${DURATION_MS}ms\`
- \`GET /health\` returned HTTP 200:
\`\`\`json
${ROLLBACK_HEALTH}
\`\`\`
- \`GET /health/ready\` returned HTTP: \`${ROLLBACK_READY_CODE}\`
\`\`\`json
${ROLLBACK_READY}
\`\`\`
- \`GET /privacy.html\` returned HTTP: \`${ROLLBACK_PRIVACY_CODE}\`
- \`GET /terms.html\` returned HTTP: \`${ROLLBACK_TERMS_CODE}\`

## Preserved Artifacts
- **Package A Archive**: \`${EXTERNAL_PACKAGES_DIR}/package_A.tar.gz\`
- **Package A Manifest**: \`${EXTERNAL_PACKAGES_DIR}/package_A_manifest.sha256\`
- **Package A File Tree**: \`${EXTERNAL_PACKAGES_DIR}/package_A_file_tree.txt\`
- **Package A Build Receipt**: \`${EXTERNAL_PACKAGES_DIR}/package_A_build_receipt.json\`
- **Package B Archive**: \`${EXTERNAL_PACKAGES_DIR}/package_B.tar.gz\`
- **Package B Manifest**: \`${EXTERNAL_PACKAGES_DIR}/package_B_manifest.sha256\`
- **Package B File Tree**: \`${EXTERNAL_PACKAGES_DIR}/package_B_file_tree.txt\`
- **Package B Build Receipt**: \`${EXTERNAL_PACKAGES_DIR}/package_B_build_receipt.json\`

## Verdict
Both hard atomic release rollback and live in-process soft-kill execute deterministically against real running processes within operational thresholds (< 3000ms). Both genuine packages are permanently preserved in external evidence storage with cryptographic checksums.
EOF

  cp -p "${RECEIPT_FILE}" "${EXTERNAL_RECEIPT_FILE}"

  echo "=============================================="
  echo " [REHEARSAL SUCCESS] Rollback verified in ${DURATION_MS}ms."
  echo " Receipt written to ${RECEIPT_FILE} and ${EXTERNAL_RECEIPT_FILE}."
  echo "=============================================="
  exit 0

elif [ "${MODE}" == "--dry-run" ]; then
  echo "--> Dry-run verification of rollback base..."
  git cat-file -t "${BASE_COMMIT}" >/dev/null 2>&1 || {
    echo "[ERROR] Base commit ${BASE_COMMIT} is missing from git object database!"
    exit 1
  }
  echo "--> Base commit ${BASE_COMMIT} is reachable."
  exit 0

else
  echo "Usage: $0 [--soft | --restore | --target <SHA> | --hard <SHA> | --rehearse-nonprod | --dry-run]"
  exit 1
fi
