/**
 * Get employee by Firebase Auth UID
 */
export const getEmployeeByAuthUid = async (authUid: string): Promise<Employee | null> => {
    const q = query(collection(db, COLLECTION_NAME), where('authUid', '==', authUid));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        return docToEmployee(doc.id, doc.data() as EmployeeDoc);
    }
    return null;
};
