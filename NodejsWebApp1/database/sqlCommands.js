const sqlCommands = {

    sqlQueryRelationship: "SELECT E1.id AS parentId, E1.item AS parent, E2.id AS childId, E2.item AS child \
    FROM relationship R \
    LEFT JOIN exampleTable E1 ON R.parentId = E1.id \
    LEFT JOIN exampleTable E2 ON R.childId = E2.id \
    ORDER BY R.parentId, R.childId;",
};

module.exports = sqlCommands;