-- Report versioning: each Report of a PoC gets a sequence number (its major version) and each
-- Report Comment a kind. Report comments are the minor versions shown in Appendix B.
ALTER TABLE report_data ADD COLUMN seq integer;
UPDATE report_data r SET seq = n.seq
FROM (SELECT id, row_number() OVER (PARTITION BY poc_id ORDER BY created_at, id) AS seq FROM report_data) n
WHERE n.id = r.id;
ALTER TABLE report_data ALTER COLUMN seq SET NOT NULL;
CREATE UNIQUE INDEX report_data_poc_seq_idx ON report_data (poc_id, seq);

ALTER TABLE report_comments ADD COLUMN kind text NOT NULL DEFAULT 'internal' CHECK (kind IN ('internal', 'report'));

-- A private comment is hidden from Customer Users. Only staff can write one, and only an internal
-- comment can be private: a Report comment is printed in the Report the Customer downloads.
ALTER TABLE report_comments ADD COLUMN is_private boolean NOT NULL DEFAULT false;
ALTER TABLE report_comments ADD CONSTRAINT report_comments_private_internal CHECK (NOT is_private OR kind = 'internal');
